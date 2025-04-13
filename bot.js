const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');
const fetch = require('node-fetch'); // Self-ping uchun fetch

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const DOMAIN = 'https://fazo-bot.onrender.com';
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(TOKEN);
const app = express();

const adminId = parseInt(process.env.ADMIN_ID);
const USERS_FILE = 'users.json';
let users = {};
let userMessageIds = {};
let userFinalMessageId = {};
const technicianLogs = {
    'K.Abdufatto': [],
    'A.Saidakbar': []
};

// Webhook setup
app.use(bot.webhookCallback('/bot'));
bot.telegram.setWebhook(${DOMAIN}/bot);

// Monitoring route
app.get('/', (req, res) => {
    res.send('Bot ishga tushdi ✅');
});

// Load/save users
function loadUsers() {
    if (fs.existsSync(USERS_FILE)) {
        users = JSON.parse(fs.readFileSync(USERS_FILE));
    }
}
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function registerUser(user) {
    const userId = user.id;
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            name: ${user.first_name || ''} ${user.last_name || ''}.trim(),
            username: user.username || '',
            canUseBot: false,
            queue: [],
            current: null,
            step: null,
            processing: false
        };
        saveUsers();
    }
}
function checkUserPermission(userId) {
    return userId === adminId || users[userId]?.canUseBot;
}
function saveMessageId(userId, messageId) {
    if (!userMessageIds[userId]) userMessageIds[userId] = [];
    userMessageIds[userId].push(messageId);
}
function deletePreviousMessages(ctx, userId) {
    const messages = userMessageIds[userId] || [];
    for (const msgId of messages) {
        if (msgId !== userFinalMessageId[userId]) {
            ctx.telegram.deleteMessage(userId, msgId).catch(() => {});
        }
    }
    userMessageIds[userId] = [];
}
async function startSurvey(ctx, userId) {
    if (users[userId].processing || users[userId].current) return;
    const current = users[userId].queue.shift();
    if (!current) {
        users[userId].current = null;
        users[userId].step = null;
        saveUsers();
        return;
    }
    users[userId].processing = true;
    users[userId].current = { photo: current, stanok: null, texnikXizmat: null, xizmat_oluvchi: null };
    users[userId].step = 'stanok';
    saveUsers();
    try {
        const photoMsg = await ctx.replyWithPhoto(current, { caption: '🖼 Ushbu rasm uchun savollar boshlanadi.' });
        saveMessageId(userId, photoMsg.message_id);
        const msg = await ctx.reply('Qaysi stanok uchun xizmat ko\'rsatildi?', {
            reply_markup: {
                keyboard: Array.from({ length: 68 }, (_, i) => [{ text: ${i + 1} }]),
                resize_keyboard: true
            }
        });
        saveMessageId(userId, msg.message_id);
    } catch (e) {
        console.log("Xatolik survey boshlashda:", e);
        users[userId].processing = false;
    }
}

loadUsers();

bot.start((ctx) => {
    const userId = ctx.from.id;
    registerUser(ctx.from);

    if (userId === adminId) {
        return ctx.reply('🤖 Xush kelibsiz, hurmatli admin!', {
            reply_markup: {
                keyboard: [
                    ['👨‍🔧 Ustalar faoliyati'],
                    ['📋 Foydalanuvchilar ro\'yxatini ko\'rish']
                ],
                resize_keyboard: true
            }
        });
    }

    if (!checkUserPermission(userId)) {
        bot.telegram.sendMessage(adminId, 🆕 Yangi foydalanuvchi:\n🆔 ID: ${userId}\nIsmi: ${ctx.from.first_name} ${ctx.from.last_name || ''}\nUsername: @${ctx.from.username || 'Nomaʼlum'}, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Ruxsat berish', callback_data: grant_${userId} },
                        { text: '❌ Ruxsat bermaslik', callback_data: revoke_${userId} }
                    ]
                ]
            }
        });

        return ctx.reply('👋 Xush kelibsiz!\n❌ Sizga hali ruxsat berilmagan. Iltimos, admin ruxsatini kuting.', {
            reply_markup: { remove_keyboard: true }
        });
    }

    ctx.reply('✅ Xush kelibsiz! Botdan foydalanish uchun rasm yuboring.', {
        reply_markup: { remove_keyboard: true }
    });
});

bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    registerUser(ctx.from);
    if (!checkUserPermission(userId)) return ctx.reply('❌ Sizga hali ruxsat yo‘q.');

    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    users[userId].queue.push(photoId);
    saveUsers();

    saveMessageId(userId, ctx.message.message_id);

    if (!users[userId].processing && !users[userId].current) {
        deletePreviousMessages(ctx, userId);
        await startSurvey(ctx, userId);
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    registerUser(ctx.from);
    saveMessageId(userId, ctx.message.message_id);

    if (!checkUserPermission(userId) && userId !== adminId) {
        return ctx.reply('❌ Sizga hali ruxsat yo‘q.');
    }

    if (userId === adminId) {
        if (text === '📋 Foydalanuvchilar ro\'yxatini ko\'rish') {
            Object.values(users).forEach(user => {
                const name = user.username ? @${user.username} : user.name;
                const status = user.canUseBot ? '✅ Ruxsat berilgan' : '🚫 Ruxsat yo‘q';
                ctx.reply(🆔 ID: ${user.id}\n👤 Foydalanuvchi: ${name}\n🔓 Holat: ${status}, {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Ruxsat berish', callback_data: grant_${user.id} },
                            { text: '❌ Ruxsat bermaslik', callback_data: revoke_${user.id} }
                        ]]
                    }
                });
            });
            return;
        }

        if (text === '👨‍🔧 Ustalar faoliyati') {
            return ctx.reply('Qaysi usta faoliyatini ko‘rmoqchisiz?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👨‍🔧 K.Abdufatto', callback_data: 'show_K.Abdufatto' }],
                        [{ text: '👨‍🔧 A.Saidakbar', callback_data: 'show_A.Saidakbar' }]
                    ]
                }
            });
        }
    }

    const step = users[userId]?.step;
    const current = users[userId]?.current;
    if (!step || !current) return;

    if (step === 'stanok' && !isNaN(text)) {
        users[userId].current.stanok = text;
        users[userId].step = 'texnik_xizmat';
        saveUsers();

        return ctx.reply('Texnik xizmat turini tanlang:', {
            reply_markup: {
                keyboard: [
                    ['Накапител плата', 'Накапител сенсор'],
                    ['Филер сенсор', 'Филер плата'],
                    ['Инвертор', 'Серво мотор'],
                    ['Материнский плата', 'Блок питания']
                ],
                resize_keyboard: true
            }
        }).then(msg => saveMessageId(userId, msg.message_id));
    }

    if (step === 'texnik_xizmat') {
        users[userId].current.texnikXizmat = text;
        users[userId].step = 'xizmat_oluvchi';
        saveUsers();

        return ctx.reply('Kim tomonidan xizmat ko‘rsatildi?', {
            reply_markup: {
                keyboard: [['K.Abdufatto', 'A.Saidakbar']],
                resize_keyboard: true
            }
        }).then(msg => saveMessageId(userId, msg.message_id));
    }

    if (step === 'xizmat_oluvchi') {
        users[userId].current.xizmat_oluvchi = text;
        const { photo, stanok, texnikXizmat, xizmat_oluvchi } = users[userId].current;
        const date = new Date();
        const sana = ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')};

        const caption = 📄 Ma'lumot:\n🕒 Sana va vaqt: ${sana}\n🔧 Stanok: ${stanok}\n🔍 Xizmat: ${texnikXizmat}\n👨‍🔧 Xizmat ko‘rsatuvchi: ${xizmat_oluvchi};

        try {
            const finalMessage = await ctx.replyWithPhoto(photo, { caption });
            userFinalMessageId[userId] = finalMessage.message_id;
        } catch (err) {
            console.error('Rasm yuborishda xato:', err);
        }

        deletePreviousMessages(ctx, userId);

        if (technicianLogs[xizmat_oluvchi]) {
            technicianLogs[xizmat_oluvchi].push({ photo, caption });
        }

        users[userId].current = null;
        users[userId].step = null;
        users[userId].processing = false;
        saveUsers();

        const replyMarkup = (userId === adminId) ? {
            keyboard: [
                ['👨‍🔧 Ustalar faoliyati'],
                ['📋 Foydalanuvchilar ro\'yxatini ko\'rish']
            ],
            resize_keyboard: true
        } : { remove_keyboard: true };

        ctx.reply('✅ Maʼlumot yuborildi.', {
            reply_markup: replyMarkup
        });

        if (users[userId].queue.length > 0) {
            await startSurvey(ctx, userId);
        }
    }
});

bot.action(/show_(.+)/, (ctx) => {
    const name = ctx.match[1];
    const logs = technicianLogs[name];
    if (!logs || logs.length === 0) {
        return ctx.reply(📭 ${name} tomonidan xizmat yo‘q.);
    }

    logs.forEach(log => {
        ctx.replyWithPhoto(log.photo, { caption: log.caption });
    });

    ctx.answerCbQuery();
});

bot.action(/grant_(\d+)/, async (ctx) => {
    const uid = ctx.match[1];
    registerUser({ id: parseInt(uid) });
    users[uid].canUseBot = true;
    saveUsers();

    await ctx.answerCbQuery(✅ ${uid} ga ruxsat berildi);
    try {
        await ctx.telegram.sendMessage(uid, '✅ Sizga ruxsat berildi. Endi botdan foydalanishingiz mumkin.');
    } catch (err) {
        console.log(Xabar yuborilmadi: ${uid});
    }
});

bot.action(/revoke_(\d+)/, async (ctx) => {
    const uid = ctx.match[1];
    registerUser({ id: parseInt(uid) });
    users[uid].canUseBot = false;
    saveUsers();

    await ctx.answerCbQuery(🚫 ${uid} dan ruxsat olib tashlandi);
    try {
        await ctx.telegram.sendMessage(uid, '🚫 Sizning botdan foydalanish huquqingiz olib tashlandi.');
    } catch (err) {
        console.log(Xabar yuborilmadi: ${uid});
    }
});

app.listen(PORT, () => {
    console.log(🌐 Bot ishga tushdi (webhook mode): http://localhost:${PORT});
});

// 🔁 Self-ping to keep Render app awake
setInterval(() => {
    fetch(DOMAIN)
        .then(() => console.log('🔁 Self-ping yuborildi.'))
        .catch(err => console.log('⚠️ Self-ping xatoligi:', err));
}, 60 * 1000); 
