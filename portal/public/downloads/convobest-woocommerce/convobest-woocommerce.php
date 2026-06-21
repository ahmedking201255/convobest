<?php
/**
 * Plugin Name: ConvoBest WooCommerce WhatsApp Notifications
 * Description: إرسال إشعارات وتنبيهات تلقائية للعملاء على الواتساب عند تغيير حالة الطلب عبر ConvoBest Portal.
 * Version: 1.0.0
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
        'section_end' => array(
            'type' => 'sectionend',
            'id' => 'convobest_section_end'
        )
    );
}

// 5. Hook WooCommerce Order Status Changes
add_action('woocommerce_order_status_changed', 'convobest_on_order_status_changed', 10, 4);
function convobest_on_order_status_changed($order_id, $old_status, $new_status, $order) {
    $api_url = get_option('convobest_api_url');
    $api_key = get_option('convobest_api_key');

    if (empty($api_url) || empty($api_key)) {
        return; // Connection details are missing
    }

    $billing_phone = $order->get_billing_phone();
    if (empty($billing_phone)) {
        return; // Customer has no phone number
    }

    $first_name = $order->get_billing_first_name();
    $last_name = $order->get_billing_last_name();
    $customer_name = trim($first_name . ' ' . $last_name);
    if (empty($customer_name)) {
        $customer_name = 'عميلنا العزيز';
    }

    // Build the payload
    $payload = array(
        'apiKey'        => $api_key,
        'orderId'       => (string)$order_id,
        'status'        => $new_status,
        'customerName'  => $customer_name,
        'customerPhone' => $billing_phone,
        'total'         => (string)$order->get_total(),
        'currency'      => $order->get_currency()
    );

    // Dispatch POST request to the ConvoBest portal
    wp_remote_post($api_url, array(
        'method'    => 'POST',
        'headers'   => array('Content-Type' => 'application/json; charset=utf-8'),
        'body'      => json_encode($payload),
        'timeout'   => 10,
        'blocking'  => false // Do not delay checkout page reload for the user
    ));
}
