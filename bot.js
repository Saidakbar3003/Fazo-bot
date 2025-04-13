const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');
const fetch = require('node-fetch');

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const DOMAIN = 'https://fazo-bot.onrender.com';
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(TOKEN);
const app = express();

const adminId = parseInt(process.env.ADMIN_ID);
const DEPLOY_HOOK_URL = 'https://api.render.com/deploy/srv-cvt7du95pdvs739h3pj0?key=txzklcHbGFw';

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
bot.telegram.setWebhook(`${DOMAIN}/bot`);

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
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
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
                keyboard: Array.from({ length: 68 }, (_, i) => [{ text: `${i + 1}` }]),
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
                    ['📋 Foydalanuvchilar ro\'yxatini ko\'rish'],
                    ['♻️ Redeploy'] // <<=== Admin uchun tugma
                ],
                resize_keyboard: true
            }
        });
    }

    if (!checkUserPermission(userId)) {
        bot.telegram.sendMessage(adminId, `🆕 Yangi foydalanuvchi:\n🆔 ID: ${userId}\nIsmi: ${ctx.from.first_name} ${ctx.from.last_name || ''}\nUsername: @${ctx.from.username || 'Nomaʼlum'}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Ruxsat berish', callback_data: `grant_${userId}` },
                        { text: '❌ Ruxsat bermaslik', callback_data: `revoke_${userId}` }
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

// Admin uchun redeploy tugmasi
bot.hears('♻️ Redeploy', (ctx) => {
    if (ctx.from.id !== adminId) return;
    ctx.reply('♻️ Redeploy qilishni tasdiqlang:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '♻️ Redeploy', callback_data: 'do_redeploy' }]
            ]
        }
    });
});

bot.action('do_redeploy', async (ctx) => {
    if (ctx.from.id !== adminId) return ctx.answerCbQuery('Faqat admin ishlata oladi.');

    try {
        await fetch(DEPLOY_HOOK_URL, { method: 'POST' });
        await ctx.answerCbQuery('✅ Redeploy boshlandi');
        await ctx.reply('🛠 Bot redeploy qilinmoqda...');
    } catch (error) {
        console.error('Redeploy xatoligi:', error);
        await ctx.answerCbQuery('❌ Xatolik yuz berdi');
        await ctx.reply('⚠️ Redeploy qilishda xatolik.');
    }
});

// Express listener
app.listen(PORT, () => {
    console.log(`🌐 Bot ishga tushdi (webhook mode): http://localhost:${PORT}`);
});

// 🔁 Render’ni uxlamaslik uchun self-ping
setInterval(() => {
    fetch(DOMAIN)
        .then(() => console.log('🔁 Self-ping yuborildi.'))
        .catch(err => console.log('⚠️ Self-ping xatoligi:', err));
}, 60 * 1000);
