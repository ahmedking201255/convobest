<?php
/**
 * Plugin Name: ConvoBest WooCommerce WhatsApp Notifications
 * Description: إرسال إشعارات وتنبيهات تلقائية للعملاء على الواتساب عند تغيير حالة الطلب عبر ConvoBest Portal.
 * Version: 1.1.0
 * Author: ConvoBest
 * Text Domain: convobest-woocommerce
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// 1. Add Custom Tab to WooCommerce Settings
add_filter('woocommerce_settings_tabs_array', 'convobest_add_settings_tab', 50);
function convobest_add_settings_tab($settings_tabs) {
    $settings_tabs['convobest_tab'] = 'ConvoBest WhatsApp';
    return $settings_tabs;
}

// 2. Render Settings in the tab
add_action('woocommerce_settings_tabs_convobest_tab', 'convobest_settings_tab_content');
function convobest_settings_tab_content() {
    woocommerce_admin_fields(convobest_get_settings());
}

// 3. Save Settings
add_action('woocommerce_update_options_convobest_tab', 'convobest_update_settings');
function convobest_update_settings() {
    woocommerce_update_options(convobest_get_settings());
}

// 4. Define settings structure
function convobest_get_settings() {
    return array(
        'section_title' => array(
            'name'     => 'إعدادات ربط واتساب ConvoBest',
            'type'     => 'title',
            'desc'     => 'قم بتهيئة مفتاح الربط ورابط التكامل المباشر مع بوابة ConvoBest لتفعيل إرسال الرسائل التلقائية لعملائك.',
            'id'       => 'convobest_section_title'
        ),
        'api_url' => array(
            'name'     => 'رابط الويب هوك (Webhook URL)',
            'type'     => 'text',
            'desc'     => 'رابط بوابة الـ API للمنصة لاستقبال الأحداث. الافتراضي: <code>http://localhost:3000/api/integration/woocommerce</code>',
            'id'       => 'convobest_api_url',
            'default'  => 'http://localhost:3000/api/integration/woocommerce',
            'css'      => 'min-width: 400px;'
        ),
        'api_key' => array(
            'name'     => 'مفتاح الربط الفريد (API Key)',
            'type'     => 'text',
            'desc'     => 'مفتاح التكامل الفريد الخاص برقم الواتساب النشط الذي نسخته من لوحة تحكم ConvoBest.',
            'id'       => 'convobest_api_key',
            'css'      => 'min-width: 400px;'
        ),
        'country_code' => array(
            'name'     => 'Default country code',
            'type'     => 'text',
            'desc'     => 'Used when the billing phone starts with a local zero. Example: 20 for Egypt.',
            'id'       => 'convobest_country_code',
            'default'  => '20',
            'css'      => 'width: 120px;'
        ),
        'section_end' => array(
            'type' => 'sectionend',
            'id' => 'convobest_section_end'
        )
    );
}

// 5. Queue notifications for both initial order creation and later status changes.
add_action('woocommerce_checkout_order_created', 'convobest_on_order_created', 10, 1);
function convobest_on_order_created($order) {
    if ($order instanceof WC_Order) {
        convobest_queue_order_notification($order->get_id(), $order->get_status());
    }
}

add_action('woocommerce_order_status_changed', 'convobest_on_order_status_changed', 10, 4);
function convobest_on_order_status_changed($order_id, $old_status, $new_status, $order) {
    convobest_queue_order_notification($order_id, $new_status);
}

add_action('convobest_dispatch_order_notification', 'convobest_dispatch_order_notification', 10, 3);

function convobest_queue_order_notification($order_id, $status) {
    $supported_statuses = array('pending', 'processing', 'completed');
    $status = sanitize_key($status);
    if (!in_array($status, $supported_statuses, true)) {
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        return;
    }

    $notified = (array) $order->get_meta('_convobest_notified_statuses', true);
    $queued = (array) $order->get_meta('_convobest_queued_statuses', true);
    if (in_array($status, $notified, true) || in_array($status, $queued, true)) {
        return;
    }

    $queued[] = $status;
    $order->update_meta_data('_convobest_queued_statuses', array_values(array_unique($queued)));
    $order->save_meta_data();

    if (function_exists('as_enqueue_async_action')) {
        as_enqueue_async_action(
            'convobest_dispatch_order_notification',
            array($order_id, $status, 0),
            'convobest'
        );
        return;
    }

    convobest_dispatch_order_notification($order_id, $status, 0);
}

function convobest_normalize_phone($phone) {
    $phone = preg_replace('/\D+/', '', (string) $phone);
    if (strpos($phone, '00') === 0) {
        return substr($phone, 2);
    }
    if (strpos($phone, '0') === 0) {
        $country_code = preg_replace('/\D+/', '', (string) get_option('convobest_country_code', '20'));
        return $country_code . ltrim($phone, '0');
    }
    return $phone;
}

function convobest_dispatch_order_notification($order_id, $status, $attempt = 0) {
    $order = wc_get_order($order_id);
    $api_url = (string) get_option('convobest_api_url');
    $api_key = (string) get_option('convobest_api_key');
    $logger = wc_get_logger();
    $context = array('source' => 'convobest-woocommerce');

    if (!$order || $api_url === '' || $api_key === '') {
        $logger->error('Order or ConvoBest connection settings are missing.', $context);
        return;
    }

    $phone = convobest_normalize_phone($order->get_billing_phone());
    if ($phone === '') {
        $logger->error('Order #' . $order_id . ' has no valid billing phone.', $context);
        return;
    }

    $customer_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    if ($customer_name === '') {
        $customer_name = 'عميلنا العزيز';
    }

    $response = wp_remote_post($api_url, array(
        'headers' => array('Content-Type' => 'application/json; charset=utf-8'),
        'body' => wp_json_encode(array(
            'apiKey' => $api_key,
            'orderId' => (string) $order_id,
            'status' => $status,
            'customerName' => $customer_name,
            'customerPhone' => $phone,
            'total' => (string) $order->get_total(),
            'currency' => $order->get_currency(),
        )),
        'timeout' => 20,
        'blocking' => true,
    ));

    $response_code = is_wp_error($response) ? 0 : (int) wp_remote_retrieve_response_code($response);
    if (!is_wp_error($response) && $response_code >= 200 && $response_code < 300) {
        $notified = (array) $order->get_meta('_convobest_notified_statuses', true);
        $notified[] = $status;
        $order->update_meta_data('_convobest_notified_statuses', array_values(array_unique($notified)));
        $order->save_meta_data();
        $logger->info('Notification sent for order #' . $order_id . ' with status ' . $status . '.', $context);
        return;
    }

    $error = is_wp_error($response)
        ? $response->get_error_message()
        : 'HTTP ' . $response_code . ': ' . wp_remote_retrieve_body($response);
    $logger->error('Notification failed for order #' . $order_id . ': ' . $error, $context);

    if ((int) $attempt < 2 && function_exists('as_schedule_single_action')) {
        as_schedule_single_action(
            time() + 300,
            'convobest_dispatch_order_notification',
            array($order_id, $status, (int) $attempt + 1),
            'convobest'
        );
    }
}
