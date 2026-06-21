'use client';

import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Globe, 
  Send, 
  ArrowLeftRight,
  Code,
  Layers,
  CheckCircle2,
  Clock,
  HelpCircle,
  Eye,
  AlertCircle,
  Users,
  Radio,
  Inbox,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';

// Full DB of all WhatsApp engine, status, group, inbox & webhook endpoints
const ENDPOINTS_DATA: Record<string, any[]> = {
  send: [
    {
      id: 'send-text',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/v1/send/text',
      title: 'إرسال رسالة نصية (Text Message)',
      description: 'إرسال رسالة نصية بسيطة إلى رقم هاتف محدد بالصيغة الدولية. تدعم الرموز التعبيرية والروابط والاقتباسات.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك (Token).' },
        { name: 'Content-Type', type: 'string', required: true, description: 'يجب أن تكون application/json.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم الدولي بدون فواصل أو علامات زائد (مثال: 201012345678).' },
        { name: 'text', type: 'string', required: true, description: 'محتوى الرسالة النصية المراد إرسالها.' },
        { name: 'delay', type: 'number', required: false, description: 'زمن تأخير محاكاة الكتابة بالملي ثانية (مثال: 1200).' },
        { name: 'quoted', type: 'object', required: false, description: 'كائن يحتوي على معرّف الرسالة المقتبسة للرد عليها { messageId, participant }.' }
      ],
      payload: {
        number: '201012345678',
        text: 'مرحباً بك! هذه رسالة نصية مرسلة عبر الـ API الخاص بـ ConvoBest. 🚀',
        delay: 1000
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D271'
          },
          message: {
            extendedTextMessage: {
              text: 'مرحباً بك! هذه رسالة نصية مرسلة عبر الـ API الخاص بـ ConvoBest. 🚀'
            }
          },
          messageTimestamp: 1781836678
        }
      }
    },
    {
      id: 'send-media',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/v1/send/media',
      title: 'إرسال وسائط (Media Message)',
      description: 'إرسال صورة أو فيديو أو مستند أو رسالة صوتية باستخدام رابط URL مباشر أو ملف مشفر بصيغة base64.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك (Token).' },
        { name: 'Content-Type', type: 'string', required: true, description: 'يجب أن تكون application/json.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'type', type: 'string', required: true, description: 'نوع المرفق: image أو video أو document أو audio.' },
        { name: 'url', type: 'string', required: true, description: 'رابط مباشر للملف المرفوع، أو كود ملف مشفر base64.' },
        { name: 'caption', type: 'string', required: false, description: 'نص يظهر أسفل المرفق (للصور والفيديوهات فقط).' },
        { name: 'filename', type: 'string', required: false, description: 'اسم الملف المقترح عند استلامه (للمستندات فقط).' }
      ],
      payload: {
        number: '201012345678',
        type: 'image',
        url: 'https://convobest.com/banner.png',
        caption: 'شاهد عرضنا الخاص لليوم! 🔥',
        filename: 'banner.png'
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D272'
          },
          message: {
            imageMessage: {
              url: 'https://example.com/file.enc',
              mimetype: 'image/png',
              caption: 'شاهد عرضنا الخاص لليوم! 🔥'
            }
          },
          messageTimestamp: 1781836680
        }
      }
    },
    {
      id: 'send-sticker',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/sticker',
      title: 'إرسال ملصق (Sticker Message)',
      description: 'إرسال ملصق متحرك أو ثابت بصيغة WebP إلى رقم الهاتف المحدد.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'sticker', type: 'string', required: true, description: 'رابط مباشر لملصق بصيغة webp أو كود base64 للملصق.' }
      ],
      payload: {
        number: '201012345678',
        sticker: 'https://example.com/sticker.webp'
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D273'
          },
          message: {
            stickerMessage: {
              url: 'https://example.com/sticker.enc',
              mimetype: 'image/webp'
            }
          },
          messageTimestamp: 1781836682
        }
      }
    },
    {
      id: 'send-poll',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/poll',
      title: 'إرسال استطلاع رأي (Poll Message)',
      description: 'إنشاء وإرسال استطلاع رأي تفاعلي يحتوي على خيارات تصويت محددة.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'question', type: 'string', required: true, description: 'السؤال أو عنوان الاستطلاع.' },
        { name: 'options', type: 'array', required: true, description: 'قائمة الخيارات المتاحة للتصويت (حد أدنى خيارين).' },
        { name: 'maxAnswer', type: 'number', required: false, description: 'أقصى عدد للخيارات التي يمكن للمستخدم اختيارها (افتراضي: 1).' }
      ],
      payload: {
        number: '201012345678',
        question: 'ما هو موعد الاجتماع المفضل لديك؟',
        options: ['الساعة 10 صباحاً', 'الساعة 2 ظهراً', 'الساعة 6 مساءً'],
        maxAnswer: 1
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D274'
          },
          message: {
            pollCreationMessage: {
              name: 'ما هو موعد الاجتماع المفضل لديك؟',
              options: [
                { optionName: 'الساعة 10 صباحاً' },
                { optionName: 'الساعة 2 ظهراً' },
                { optionName: 'الساعة 6 مساءً' }
              ],
              selectableOptionsCount: 1
            }
          },
          messageTimestamp: 1781836685
        }
      }
    },
    {
      id: 'send-location',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/location',
      title: 'إرسال موقع جغرافي (Location)',
      description: 'إرسال موقع محدد على الخريطة بإحداثيات الطول والعرض وتسمية العنوان والاسم الجغرافي.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'name', type: 'string', required: true, description: 'اسم المكان الجغرافي (مثال: مقر ConvoBest الرئيسي).' },
        { name: 'address', type: 'string', required: true, description: 'العنوان التفصيلي للموقع.' },
        { name: 'latitude', type: 'number', required: true, description: 'درجة العرض الإحداثية (مثال: 30.0254).' },
        { name: 'longitude', type: 'number', required: true, description: 'درجة الطول الإحداثية (مثال: 31.4423).' }
      ],
      payload: {
        number: '201012345678',
        name: 'مقر ConvoBest الرئيسي',
        address: 'شارع التسعين، التجمع الخامس، القاهرة، مصر',
        latitude: 30.0254,
        longitude: 31.4423
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D275'
          },
          message: {
            locationMessage: {
              degreesLatitude: 30.0254,
              degreesLongitude: 31.4423,
              name: 'مقر ConvoBest الرئيسي',
              address: 'شارع التسعين، التجمع الخامس، القاهرة، مصر'
            }
          },
          messageTimestamp: 1781836690
        }
      }
    },
    {
      id: 'send-contact',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/contact',
      title: 'إرسال جهة اتصال (Contact)',
      description: 'إرسال كارت اتصال (VCard) لشخص أو ممثل مبيعات لمشاركتها مباشرة مع المستلم.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'vcard', type: 'object', required: true, description: 'كائن يحتوي على تفاصيل الاتصال { fullName, phone }.' }
      ],
      payload: {
        number: '201012345678',
        vcard: {
          fullName: 'فريق دعم ConvoBest',
          phone: '201012345678'
        }
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D276'
          },
          message: {
            contactMessage: {
              displayName: 'فريق دعم ConvoBest',
              vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:فريق دعم ConvoBest\nTEL;waid=201012345678:+201012345678\nEND:VCARD'
            }
          },
          messageTimestamp: 1781836695
        }
      }
    },
    {
      id: 'send-button',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/button',
      title: 'إرسال أزرار تفاعلية (Buttons)',
      description: 'إرسال رسائل تحتوي على أزرار تفاعلية سريعة الرد، أو روابط تشعبية، أو أزرار اتصال هاتفي.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف المستلم بالصيغة الدولية.' },
        { name: 'title', type: 'string', required: true, description: 'عنوان الترويسة العلوية للرسالة.' },
        { name: 'description', type: 'string', required: true, description: 'النص الأساسي ومحتوى الرسالة.' },
        { name: 'footer', type: 'string', required: true, description: 'نص التذييل الصغير أسفل الرسالة.' },
        { name: 'buttons', type: 'array', required: true, description: 'مصفوفة الأزرار: تدعم type كـ (reply, url, call).' }
      ],
      payload: {
        number: '201012345678',
        title: 'تأكيد التسجيل بـ ConvoBest',
        description: 'شكراً لتسجيلك، يرجى تأكيد الموعد بالضغط على الزر أدناه:',
        footer: 'ConvoBest API Service',
        buttons: [
          { type: 'reply', displayText: 'تأكيد الموعد ✅', id: 'confirm_appointment' },
          { type: 'url', displayText: 'رابط لوحة التحكم 💻', url: 'https://convobest.com' },
          { type: 'call', displayText: 'اتصل بالمبيعات 📞', phoneNumber: '+201012345678' }
        ]
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net',
            fromMe: true,
            id: '3A884218BD99C318D277'
          },
          message: {
            buttonsMessage: {
              contentText: 'شكراً لتسجيلك، يرجى تأكيد الموعد بالضغط على الزر أدناه:',
              footerText: 'ConvoBest API Service',
              buttons: [
                { buttonId: 'confirm_appointment', buttonText: { displayText: 'تأكيد الموعد ✅' }, type: 1 }
              ]
            }
          },
          messageTimestamp: 1781836700
        }
      }
    }
  ],
  groups: [
    {
      id: 'group-text-explanation',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/v1/send/text',
      title: 'إرسال رسائل وميديا للجروبات (Send to Group)',
      description: 'لإرسال أي نوع رسالة (نص، ميديا، استطلاع، إلخ) إلى مجموعة واتساب، استخدم نفس نقاط الإرسال العادية مع تبديل رقم الهاتف (number) إلى المعرّف الفريد للجروب (Group JID). وينتهي دائماً بـ @g.us.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'معرف المجموعة (Group JID) وينتهي بـ @g.us (مثال: 120363123456789012@g.us).' },
        { name: 'text', type: 'string', required: true, description: 'نص الرسالة المراد توجيهها للجروب.' }
      ],
      payload: {
        number: '120363123456789012@g.us',
        text: 'أهلاً يا شباب! هذه رسالة جماعية مرسلة من نظامنا الخارجي. 📣'
      },
      response: {
        message: 'success',
        data: {
          key: {
            remoteJid: '120363123456789012@g.us',
            fromMe: true,
            id: '3A884218BD99C318D278'
          },
          message: {
            extendedTextMessage: {
              text: 'أهلاً يا شباب! هذه رسالة جماعية مرسلة من نظامنا الخارجي. 📣'
            }
          },
          messageTimestamp: 1781836705
        }
      }
    },
    {
      id: 'group-list',
      method: 'GET',
      host: 'https://convobest.com/api',
      path: '/group/list',
      title: 'جلب قائمة المجموعات (List Groups)',
      description: 'الحصول على قائمة كاملة بجميع مجموعات الواتساب المشترك فيها هذا الرقم حالياً.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      payload: null,
      response: [
        {
          "JID": "120363123456789012@g.us",
          "Owner": "201012345678@s.whatsapp.net",
          "Subject": "مجموعة المبيعات والتسويق",
          "SubjectOwner": "201012345678@s.whatsapp.net",
          "SubjectTime": 1781650000,
          "CreationTime": 1781650000
        },
        {
          "JID": "120363987654321098@g.us",
          "Owner": "201087654321@s.whatsapp.net",
          "Subject": "إدارة العمليات",
          "SubjectOwner": "201087654321@s.whatsapp.net",
          "SubjectTime": 1781700000,
          "CreationTime": 1781700000
        }
      ]
    },
    {
      id: 'group-info',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/group/info',
      title: 'معلومات المجموعة (Group Info)',
      description: 'جلب معلومات وتفاصيل مجموعة محددة، مثل اسم المجموعة وتاريخ الإنشاء وقائمة المشاركين وأدوارهم.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'المعرّف الفريد للجروب (Group JID).' }
      ],
      payload: {
        number: '120363123456789012@g.us'
      },
      response: {
        "JID": "120363123456789012@g.us",
        "Owner": "201012345678@s.whatsapp.net",
        "Subject": "مجموعة المبيعات والتسويق",
        "Name": "مجموعة المبيعات والتسويق",
        "CreationTime": 1781650000,
        "Participants": [
          {
            "JID": "201012345678@s.whatsapp.net",
            "IsAdmin": true,
            "IsSuperAdmin": true
          },
          {
            "JID": "201087654321@s.whatsapp.net",
            "IsAdmin": false,
            "IsSuperAdmin": false
          }
        ]
      }
    },
    {
      id: 'group-create',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/group/create',
      title: 'إنشاء مجموعة جديدة (Create Group)',
      description: 'إنشاء مجموعة واتساب جديدة من خلال إعطاء اسم للمجموعة وإضافة قائمة بالمشاركين من الأرقام المسجلة.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'name', type: 'string', required: true, description: 'اسم المجموعة المراد إنشاؤها.' },
        { name: 'participants', type: 'array', required: true, description: 'مصفوفة من أرقام الهواتف المراد إضافتها بالصيغة الدولية (مثال: ["201012345678", "201087654321"]).' }
      ],
      payload: {
        name: 'دعم عملاء ConvoBest الجديد',
        participants: ['201012345678', '201087654321']
      },
      response: {
        "message": "success",
        "data": {
          "JID": "120363889911223344@g.us",
          "Subject": "دعم عملاء ConvoBest الجديد"
        }
      }
    },
    {
      id: 'group-invitelink',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/group/invitelink',
      title: 'رابط دعوة المجموعة (Invite Link)',
      description: 'جلب رابط الدعوة الخاص بالمجموعة حتى يتمكن الأشخاص الآخرون من الدخول بمجرد الضغط عليه.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'المعرّف الفريد للجروب (Group JID).' }
      ],
      payload: {
        number: '120363123456789012@g.us'
      },
      response: {
        "message": "success",
        "data": {
          "link": "https://chat.whatsapp.com/GzW9dKJdskdfksjHGD"
        }
      }
    },
    {
      id: 'group-participant',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/group/participant',
      title: 'إضافة وإزالة مشاركين (Update Participants)',
      description: 'إدارة وتعديل أعضاء المجموعة من خلال اتخاذ إجراءات مثل الإضافة (add) أو الحذف (remove) أو الترقية لمشرف (promote) أو تخفيض الرتبة (demote).',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'المعرّف الفريد للجروب (Group JID).' },
        { name: 'action', type: 'string', required: true, description: 'نوع العملية المطلوبة: add أو remove أو promote أو demote.' },
        { name: 'participants', type: 'array', required: true, description: 'مصفوفة بأرقام الهواتف أو JIDs المستهدفة بالإجراء.' }
      ],
      payload: {
        number: '120363123456789012@g.us',
        action: 'add',
        participants: ['201087654321']
      },
      response: {
        "message": "success",
        "data": {
          "status": "success",
          "participants": [
            {
              "JID": "201087654321@s.whatsapp.net",
              "Status": 200
            }
          ]
        }
      }
    },
    {
      id: 'group-leave',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/group/leave',
      title: 'مغادرة المجموعة (Leave Group)',
      description: 'الخروج ومغادرة مجموعة واتساب محددة.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'المعرّف الفريد للجروب (Group JID).' }
      ],
      payload: {
        number: '120363123456789012@g.us'
      },
      response: {
        "message": "success",
        "data": "left group successfully"
      }
    }
  ],
  statuses: [
    {
      id: 'status-text',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/status/text',
      title: 'إنشاء حالة نصية (Text Status)',
      description: 'نشر تحديث حالة (Story/Status) نصية للرقم المرتبط تظهر لجميع جهات الاتصال الخاصة بك.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان للمثيل الخاص بك.' }
      ],
      params: [
        { name: 'text', type: 'string', required: true, description: 'نص الحالة المراد نشرها.' }
      ],
      payload: {
        text: 'يسعدنا إطلاق بوابة المطورين الجديدة اليوم بـ ConvoBest! 🚀💻'
      },
      response: {
        "message": "success",
        "data": {
          "key": {
            "remoteJid": "status@broadcast",
            "fromMe": true,
            "id": "3A884218BD99C318D279"
          },
          "messageTimestamp": 1781836710
        }
      }
    },
    {
      id: 'status-media',
      method: 'POST',
      host: 'https://convobest.com/api',
      path: '/send/status/media',
      title: 'إنشاء حالة وسائط (Media Status)',
      description: 'نشر صورة أو مقطع فيديو كحالة واتساب. تدعم إرسال رابط مباشر للملف أو كود base64.',
      headers: [
        { name: 'apikey', type: 'string', required: true, description: 'مفتاح الأمان.' }
      ],
      params: [
        { name: 'type', type: 'string', required: true, description: 'نوع الحالة: image أو video.' },
        { name: 'url', type: 'string', required: true, description: 'رابط مباشر للصورة أو الفيديو المرفق.' },
        { name: 'caption', type: 'string', required: false, description: 'تعليق نصي يظهر على القصة.' }
      ],
      payload: {
        type: 'image',
        url: 'https://convobest.com/assets/new_features.png',
        caption: 'اكتشف تحديثات الصندوق الوارد لدينا! 🔥'
      },
      response: {
        "message": "success",
        "data": {
          "key": {
            "remoteJid": "status@broadcast",
            "fromMe": true,
            "id": "3A884218BD99C318D280"
          },
          "messageTimestamp": 1781836715
        }
      }
    }
  ],
  inbox: [
    {
      id: 'inbox-chats',
      method: 'GET',
      host: 'https://convobest.com',
      path: '/api/chat',
      title: 'جلب محادثات الصندوق (Get Chats)',
      description: 'جلب قائمة بالمحادثات النشطة المتواجدة في الصندوق الوارد بالنظام لتصميم واجهة مستقلة. يدعم التبويبات والبحث والترقيم.',
      headers: [
        { name: 'Cookie', type: 'string', required: true, description: 'كوكيز الجلسة المصرح بها للعميل (Session Cookie).' }
      ],
      params: [
        { name: 'instanceId', type: 'string', required: true, description: 'معرف الحساب (instanceId).' },
        { name: 'limit', type: 'number', required: false, description: 'عدد المحادثات المطلوبة (افتراضي: 40، أقصى حد: 100).' },
        { name: 'offset', type: 'number', required: false, description: 'الإزاحة للترقيم الفردي للصفحات (افتراضي: 0).' },
        { name: 'search', type: 'string', required: false, description: 'كلمة بحث لفلترة المحادثات بالرقم أو الاسم أو الرسالة الأخيرة.' },
        { name: 'tab', type: 'string', required: false, description: 'التبويب المطلوب جلبه: customers (محادثات العملاء - افتراضي) أو groups (محادثات المجموعات).' }
      ],
      payload: null,
      response: {
        "chats": [
          {
            "number": "201012345678",
            "contactName": "محمد أحمد",
            "lastMessage": "مرحبا بك! كيف يمكنني مساعدتك؟",
            "lastMessageTime": "2026-06-19T02:40:00.000Z",
            "lastMessageType": "RECEIVED",
            "lastMessageStatus": "READ",
            "hasRealMessages": true,
            "unreadCount": 0,
            "isGroup": false
          }
        ],
        "pagination": {
          "limit": 40,
          "offset": 0,
          "nextOffset": 1,
          "hasMore": false
        }
      }
    },
    {
      id: 'inbox-messages',
      method: 'GET',
      host: 'https://convobest.com',
      path: '/api/chat/messages',
      title: 'رسائل محادثة محددة (Get Messages)',
      description: 'جلب سجل الرسائل المتبادلة بالكامل لمحادثة معينة (عميل أو مجموعة) لفرشها داخل الشات.',
      headers: [
        { name: 'Cookie', type: 'string', required: true, description: 'كوكيز الجلسة.' }
      ],
      params: [
        { name: 'instanceId', type: 'string', required: true, description: 'معرف الحساب (instanceId).' },
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف العميل أو معرف المجموعة (JID).' },
        { name: 'limit', type: 'number', required: false, description: 'عدد الرسائل المطلوبة (افتراضي: 50، أقصى حد: 100).' },
        { name: 'offset', type: 'number', required: false, description: 'الإزاحة للترقيم.' }
      ],
      payload: null,
      response: {
        "messages": [
          {
            "id": "3A884218BD99C318D271",
            "instanceId": "YOUR_INSTANCE_ID",
            "number": "201012345678",
            "contactName": "محمد أحمد",
            "text": "مرحباً! أردت الاستعلام عن السعر.",
            "type": "RECEIVED",
            "status": "READ",
            "createdAt": "2026-06-19T02:35:00.000Z"
          },
          {
            "id": "3A884218BD99C318D272",
            "instanceId": "YOUR_INSTANCE_ID",
            "number": "201012345678",
            "contactName": "محمد أحمد",
            "text": "أهلاً بك يا فندم! الباقة الأساسية بسعر 4800 جنية.",
            "type": "SENT",
            "status": "READ",
            "createdAt": "2026-06-19T02:36:00.000Z"
          }
        ],
        "pagination": {
          "limit": 50,
          "offset": 0,
          "nextOffset": 2,
          "hasMore": false
        }
      }
    },
    {
      id: 'inbox-send',
      method: 'POST',
      host: 'https://convobest.com',
      path: '/api/chat/send',
      title: 'إرسال رسالة من الصندوق (Send Inbox)',
      description: 'إرسال رسالة نصية أو ملف وسائط من خلال الصندوق الوارد وتحديث قاعدة سجلات الصندوق المتبادلة فورياً.',
      headers: [
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' }
      ],
      params: [
        { name: 'instanceId', type: 'string', required: true, description: 'معرف الحساب الخاص بك.' },
        { name: 'number', type: 'string', required: true, description: 'رقم هاتف العميل أو JID الخاص بالمجموعة.' },
        { name: 'text', type: 'string', required: false, description: 'نص الرسالة المراد إرسالها (مطلوب إذا لم ترسل ملف وسائط).' },
        { name: 'mediaUrl', type: 'string', required: false, description: 'رابط ملف الوسائط (مطلوب إذا لم ترسل نصاً).' },
        { name: 'mediaType', type: 'string', required: false, description: 'نوع المرفق: image أو video أو audio أو sticker أو document.' },
        { name: 'caption', type: 'string', required: false, description: 'تعليق المرفق.' },
        { name: 'fileName', type: 'string', required: false, description: 'اسم الملف المقترح للمستند.' }
      ],
      payload: {
        instanceId: 'YOUR_INSTANCE_ID',
        number: '201012345678',
        text: 'أهلاً بك! تم حل مشكلتك الفنية بنجاح. 🛠️'
      },
      response: {
        "success": true,
        "message": {
          "id": "3A884218BD99C318D285",
          "instanceId": "YOUR_INSTANCE_ID",
          "number": "201012345678",
          "text": "أهلاً بك! تم حل مشكلتك الفنية بنجاح. 🛠️",
          "type": "SENT",
          "createdAt": "2026-06-19T02:45:00.000Z"
        }
      }
    }
  ],
  webhooks: [
    {
      id: 'webhook-message',
      method: 'POST (HTTP JSON)',
      host: 'https://yourserver.com',
      path: '/webhook',
      title: 'حدث استقبال الرسائل للعملاء والمجموعات (Message Event)',
      description: 'يتم إطلاق هذا الحدث فورياً وإرسال بيانات الرسالة المستلمة بترميز JSON إلى رابط الويب هوك الخاص بك عند استقبال رسالة من عميل فردي أو مجموعة.',
      headers: [
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' }
      ],
      payload: {
        event: 'Message',
        instanceId: 'YOUR_INSTANCE_ID',
        instanceToken: 'YOUR_INSTANCE_TOKEN',
        data: {
          key: {
            remoteJid: '201012345678@s.whatsapp.net', // أو معرف الجروب المنتهي بـ @g.us
            fromMe: false, // تعني أنها واردة من العميل وليست صادرة منك
            id: 'AC830C66D350831CF8D0D80493A1A982',
            participant: '201087654321@s.whatsapp.net' // تظهر فقط في المجموعات لتحديد المرسل الفعلي
          },
          message: {
            conversation: 'أود الاستفسار عن تفاصيل الأسعار.'
          },
          messageTimestamp: 1781754020,
          pushName: 'أحمد علي',
          groupData: { // يظهر فقط عند استقبال رسالة في المجموعات
            name: 'مجموعة المبيعات والتشغيل'
          }
        }
      },
      response: {
        success: true
      }
    },
    {
      id: 'webhook-connection',
      method: 'POST (HTTP JSON)',
      host: 'https://yourserver.com',
      path: '/webhook',
      title: 'حدث حالة الاتصال (Connection Event)',
      description: 'يتم إرسال هذا الإشعار عند حدوث أي تغيير في ارتباط هاتفك بالمنصة (ربط الهاتف بنجاح، قطع الاتصال، تسجيل الخروج).',
      headers: [
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' }
      ],
      payload: {
        event: 'Connected', // أو "Disconnected" أو "LoggedOut"
        instanceId: 'YOUR_INSTANCE_ID',
        instanceToken: 'YOUR_INSTANCE_TOKEN',
        data: {
          status: 'open',
          jid: '201012345678@s.whatsapp.net',
          pushName: 'تليفون الدعم والتشغيل'
        }
      },
      response: {
        success: true
      }
    }
  ]
};

export default function ApiDocsPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'send' | 'groups' | 'statuses' | 'inbox' | 'webhooks'>('send');
  const [selectedLang, setSelectedLang] = useState<'curl' | 'js' | 'php'>('curl');
  
  // Track selected endpoint in each tab
  const [activeEndpointId, setActiveEndpointId] = useState<string>('send-text');
  const [showResponseMap, setShowResponseMap] = useState<Record<string, boolean>>({});

  // Reset active endpoint when top tab changes
  useEffect(() => {
    const categoryEndpoints = ENDPOINTS_DATA[activeTab] || [];
    if (categoryEndpoints.length > 0) {
      setActiveEndpointId(categoryEndpoints[0].id);
    }
  }, [activeTab]);

  // Fetch user instances
  useEffect(() => {
    async function fetchInstances() {
      try {
        const res = await fetch('/api/instances');
        const data = await res.json();
        if (res.ok && data.length > 0) {
          setInstances(data);
          setSelectedInstance(data[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchInstances();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentToken = selectedInstance ? selectedInstance.token : 'YOUR_INSTANCE_TOKEN';
  const currentId = selectedInstance ? selectedInstance.id : 'YOUR_INSTANCE_ID';

  // Helper to format Javascript object as PHP array
  const toPhpArray = (obj: any, indent = 4): string => {
    const spaces = ' '.repeat(indent);
    if (obj === null) return 'null';
    if (typeof obj === 'undefined') return 'null';
    if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map(item => toPhpArray(item, indent + 4)).join(', ');
      return `[${items}]`;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '[]';
      let str = "[\n";
      keys.forEach((key, idx) => {
        str += `${spaces}    "${key}" => ${toPhpArray(obj[key], indent + 4)}${idx < keys.length - 1 ? ',' : ''}\n`;
      });
      str += `${spaces}]`;
      return str;
    }
    return 'null';
  };

  // Code Snippet Builder
  const getCodeSnippet = (endpoint: any, lang: 'curl' | 'js' | 'php') => {
    const url = `${endpoint.host}${endpoint.path}`;
    const headers = [...(endpoint.headers || [])];
    const token = currentToken;

    if (lang === 'curl') {
      let curlCmd = `curl -X ${endpoint.method} "${url}" \\\n`;
      headers.forEach(h => {
        const val = h.name === 'apikey' ? token : (h.name === 'Content-Type' ? 'application/json' : h.defaultValue || '');
        // We skip Cookie headers in cURL documentation to keep it clean, as browser session handles it automatically.
        if (h.name !== 'Cookie') {
          curlCmd += `  -H "${h.name}: ${val}" \\\n`;
        }
      });
      if (endpoint.payload) {
        const payloadCopy = JSON.parse(JSON.stringify(endpoint.payload));
        if (payloadCopy.instanceId) payloadCopy.instanceId = currentId;
        curlCmd += `  -d '${JSON.stringify(payloadCopy, null, 2)}'`;
      } else {
        curlCmd = curlCmd.trim().slice(0, -1);
      }
      return curlCmd;
    }
    
    if (lang === 'js') {
      const fetchHeaders: any = {};
      headers.forEach(h => {
        if (h.name !== 'Cookie') {
          fetchHeaders[h.name] = h.name === 'apikey' ? token : (h.name === 'Content-Type' ? 'application/json' : h.defaultValue || '');
        }
      });
      
      let jsCode = `fetch("${url}", {\n`;
      jsCode += `  method: "${endpoint.method}",\n`;
      jsCode += `  headers: ${JSON.stringify(fetchHeaders, null, 4).replace(/\n/g, '\n  ')}`;
      
      if (endpoint.payload) {
        const payloadCopy = JSON.parse(JSON.stringify(endpoint.payload));
        if (payloadCopy.instanceId) payloadCopy.instanceId = currentId;
        jsCode += `,\n  body: JSON.stringify(${JSON.stringify(payloadCopy, null, 4).replace(/\n/g, '\n  ')})`;
      }
      jsCode += `\n})\n.then(res => res.json())\n.then(data => console.log(data))\n.catch(err => console.error(err));`;
      return jsCode;
    }
    
    if (lang === 'php') {
      let phpCode = `<?php\n`;
      phpCode += `$url = "${url}";\n`;
      phpCode += `$headers = [\n`;
      headers.forEach(h => {
        if (h.name !== 'Cookie') {
          const val = h.name === 'apikey' ? token : (h.name === 'Content-Type' ? 'application/json' : h.defaultValue || '');
          phpCode += `    "${h.name}: ${val}",\n`;
        }
      });
      phpCode += `];\n`;
      
      if (endpoint.payload) {
        const payloadCopy = JSON.parse(JSON.stringify(endpoint.payload));
        if (payloadCopy.instanceId) payloadCopy.instanceId = currentId;
        phpCode += `$payload = ${toPhpArray(payloadCopy, 0)};\n\n`;
      }
      
      phpCode += `$ch = curl_init($url);\n`;
      phpCode += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
      if (endpoint.method === 'POST') {
        phpCode += `curl_setopt($ch, CURLOPT_POST, true);\n`;
        if (endpoint.payload) {
          phpCode += `curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));\n`;
        }
      } else if (endpoint.method !== 'GET') {
        phpCode += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${endpoint.method}");\n`;
      }
      phpCode += `curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n\n`;
      phpCode += `$response = curl_exec($ch);\n`;
      phpCode += `curl_close($ch);\n`;
      phpCode += `echo $response;\n`;
      phpCode += `?>`;
      return phpCode;
    }
    return '';
  };

  const activeEndpoints = ENDPOINTS_DATA[activeTab] || [];
  const selectedEndpoint = activeEndpoints.find(e => e.id === activeEndpointId) || activeEndpoints[0];

  const toggleResponse = (id: string) => {
    setShowResponseMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getMethodBadgeClass = (method: string) => {
    const base = "text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono";
    if (method.startsWith('POST')) return `${base} text-black bg-[#00ffa7]`;
    if (method.startsWith('GET')) return `${base} text-white bg-[#00b0ff]`;
    if (method.startsWith('DELETE')) return `${base} text-white bg-[#ff1744]`;
    return `${base} text-white bg-[#78909c]`;
  };

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in text-white font-sans">
      
      {/* Page Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">بوابة المطورين وتكامل الـ API</h1>
          <p className="text-xs text-[#90a4ae] mt-1">اربط أنظمتك ومواقعك البرمجية معنا، وأرسل الرسائل والميديا وأدر المجموعات والحالات مباشرة بسلاسة ودقة عالية.</p>
        </div>
        
        {/* Dynamic selector for instance tokens */}
        {!loading && instances.length > 0 && (
          <div className="flex items-center gap-2 self-start md:self-auto bg-[#0e1622] border border-white/[0.06] p-2.5 rounded-xl">
            <span className="text-[11px] text-[#90a4ae] ml-2">تخصيص الأكواد لـ:</span>
            <select
              value={selectedInstance?.id || ''}
              onChange={(e) => {
                const selected = instances.find(inst => inst.id === e.target.value);
                setSelectedInstance(selected);
              }}
              className="bg-[#060b11] text-xs font-bold text-white border-none focus:outline-none pr-6 cursor-pointer"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.status === 'CONNECTED' ? 'متصل' : 'غير متصل'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap border-b border-white/[0.04] gap-1">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'send' 
              ? 'border-[#00ffa7] text-[#00ffa7] bg-[#00ffa7]/5 font-extrabold' 
              : 'border-transparent text-[#607d8b] hover:text-white'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>إرسال الرسائل</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'groups' 
              ? 'border-[#00ffa7] text-[#00ffa7] bg-[#00ffa7]/5 font-extrabold' 
              : 'border-transparent text-[#607d8b] hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>إدارة المجموعات (Groups)</span>
        </button>

        <button
          onClick={() => setActiveTab('statuses')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'statuses' 
              ? 'border-[#00ffa7] text-[#00ffa7] bg-[#00ffa7]/5 font-extrabold' 
              : 'border-transparent text-[#607d8b] hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>حالات الواتساب (Status)</span>
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'inbox' 
              ? 'border-[#00ffa7] text-[#00ffa7] bg-[#00ffa7]/5 font-extrabold' 
              : 'border-transparent text-[#607d8b] hover:text-white'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>ربط الصندوق الوارد (Inbox API)</span>
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'webhooks' 
              ? 'border-[#00ffa7] text-[#00ffa7] bg-[#00ffa7]/5 font-extrabold' 
              : 'border-transparent text-[#607d8b] hover:text-white'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>ويب هوك الاستقبال (Webhooks)</span>
        </button>
      </div>

      {/* --- TWO-COLUMN CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Endpoints Submenu */}
        <div className="lg:col-span-1 flex flex-col gap-2 bg-[#080e14] border border-white/[0.04] p-3 rounded-xl h-fit">
          <span className="text-[10px] font-bold text-[#607d8b] px-3 uppercase tracking-wider block mb-2">نقاط الاتصال (Endpoints)</span>
          {activeEndpoints.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setActiveEndpointId(ep.id)}
              className={`w-full text-right p-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                activeEndpointId === ep.id 
                  ? 'bg-white/[0.04] text-[#00ffa7] border-r-2 border-[#00ffa7]' 
                  : 'text-[#90a4ae] hover:bg-white/[0.02] hover:text-white'
              }`}
            >
              <span className="truncate max-w-[150px]">{ep.title}</span>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded font-mono ${
                ep.method.startsWith('POST') ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'bg-[#00b0ff]/10 text-[#00b0ff]'
              }`}>
                {ep.method.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Right Side: Active Endpoint Detailed View */}
        {selectedEndpoint ? (
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Header info card */}
            <div className="bg-[#0e1622] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={getMethodBadgeClass(selectedEndpoint.method)}>{selectedEndpoint.method}</span>
                <span className="font-mono text-xs md:text-sm text-[#00ffa7] font-bold select-all">{selectedEndpoint.host}{selectedEndpoint.path}</span>
                <button 
                  onClick={() => copyToClipboard(`${selectedEndpoint.host}${selectedEndpoint.path}`, 'active-ep')}
                  className="text-[#607d8b] hover:text-white mr-auto cursor-pointer"
                  title="نسخ المسار"
                >
                  {copiedId === 'active-ep' ? <Check className="w-4 h-4 text-[#00ffa7]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{selectedEndpoint.title}</h2>
              <p className="text-xs text-[#90a4ae] leading-relaxed">{selectedEndpoint.description}</p>
            </div>

            {/* Params & Code Box grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Parameters Tables (Left inside detailed view) */}
              <div className="xl:col-span-6 flex flex-col gap-5">
                {/* Headers Table */}
                {selectedEndpoint.headers && selectedEndpoint.headers.length > 0 && (
                  <div className="bg-[#0e1622] border border-white/[0.06] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-[#00b0ff]" />
                      <span>الترويسات المطلوبة (Headers)</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[#607d8b]">
                            <th className="pb-2 font-bold">الحقل</th>
                            <th className="pb-2 font-bold px-2">النوع</th>
                            <th className="pb-2 font-bold text-left">الوصف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEndpoint.headers.map((h: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/[0.03] last:border-none">
                              <td className="py-2.5 font-mono text-[#00ffa7] font-semibold">{h.name}</td>
                              <td className="py-2.5 px-2 text-[#90a4ae]">{h.required ? 'مطلوب' : 'اختياري'}</td>
                              <td className="py-2.5 text-[#90a4ae] text-left leading-relaxed">{h.name === 'apikey' ? `مفتاح الأمان الخاص بك` : h.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Body/Query Params Table */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div className="bg-[#0e1622] border border-white/[0.06] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-[#00ffa7]" />
                      <span>المدخلات (Parameters)</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[#607d8b]">
                            <th className="pb-2 font-bold">الحقل</th>
                            <th className="pb-2 font-bold px-2">النوع</th>
                            <th className="pb-2 font-bold text-left">الوصف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEndpoint.params.map((p: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/[0.03] last:border-none">
                              <td className="py-2.5 font-mono text-[#00ffa7] font-semibold">
                                {p.name} {p.required && <span className="text-red-400 font-sans">*</span>}
                              </td>
                              <td className="py-2.5 px-2 text-[#90a4ae] font-mono">{p.type}</td>
                              <td className="py-2.5 text-[#90a4ae] text-left leading-relaxed">{p.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Code Box Generator (Right inside detailed view) */}
              <div className="xl:col-span-6 flex flex-col bg-[#070d14] rounded-xl border border-white/[0.04] overflow-hidden">
                
                {/* Lang tabs switcher */}
                <div className="flex items-center justify-between bg-[#0b121c] px-4 py-2 border-b border-white/[0.04] text-[10px] font-bold text-[#607d8b]">
                  <button 
                    onClick={() => copyToClipboard(getCodeSnippet(selectedEndpoint, selectedLang), 'snippet')}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'snippet' ? <Check className="w-3 h-3 text-[#00ffa7]" /> : <Copy className="w-3 h-3" />}
                    <span>نسخ الكود الكامل</span>
                  </button>
                  <div className="flex gap-2.5">
                    <button 
                      onClick={() => setSelectedLang('curl')} 
                      className={`px-2 py-0.5 rounded cursor-pointer ${selectedLang === 'curl' ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'hover:text-white'}`}
                    >
                      cURL
                    </button>
                    <button 
                      onClick={() => setSelectedLang('js')} 
                      className={`px-2 py-0.5 rounded cursor-pointer ${selectedLang === 'js' ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'hover:text-white'}`}
                    >
                      JavaScript
                    </button>
                    <button 
                      onClick={() => setSelectedLang('php')} 
                      className={`px-2 py-0.5 rounded cursor-pointer ${selectedLang === 'php' ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'hover:text-white'}`}
                    >
                      PHP
                    </button>
                  </div>
                </div>

                {/* Preformatted code snippet block */}
                <pre className="p-4 text-[10.5px] text-[#00ffa7] font-mono overflow-x-auto text-left leading-relaxed whitespace-pre select-all max-h-[350px]">
                  {getCodeSnippet(selectedEndpoint, selectedLang)}
                </pre>
              </div>
            </div>

            {/* Collapsible response block */}
            {selectedEndpoint.response && (
              <div className="bg-[#0e1622] border border-white/[0.06] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleResponse(selectedEndpoint.id)}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-white hover:bg-white/[0.02] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00ffa7]" />
                    <span>نموذج الاستجابة الناجحة (Response Example)</span>
                  </span>
                  {showResponseMap[selectedEndpoint.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showResponseMap[selectedEndpoint.id] && (
                  <div className="border-t border-white/[0.04] bg-[#070d14]">
                    <pre className="p-4 text-[10px] text-[#00ffa7] font-mono overflow-x-auto text-left leading-relaxed">
                      {JSON.stringify(selectedEndpoint.response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-3 bg-[#0e1622] border border-white/[0.06] rounded-xl p-8 text-center text-[#90a4ae] text-xs">
            الرجاء اختيار أحد نقاط الاتصال من القائمة لاستعراض التفاصيل.
          </div>
        )}
      </div>

      {/* General Developer Warning Notice */}
      <div className="p-4 rounded-xl bg-[#0e1622] border border-white/[0.06] text-xs text-[#90a4ae] flex items-start gap-3 mt-4">
        <AlertCircle className="w-5 h-5 text-[#00b0ff] flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed text-right">
          <span className="text-white font-bold block mb-1">الربط والويب هوك في الأنظمة الخارجية (External Integrations):</span>
          لتفعيل بوت ذكي أو استقبال الرسائل على سيرفراتكم الخارجية، يتم إعداد مستمعات ويب هوك ديناميكية للرقم تشير إلى الرابط الخاص بنظامكم. ستقوم المنصة بإرسال كائنات JSON الموضحة في قسم الويب هوك مع ترويسة <strong className="text-white">apikey</strong> للتحقق من هوية المرسل وسلامة الربط.
        </div>
      </div>
    </div>
  );
}
