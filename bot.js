const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');

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
bot.telegram.setWebhook(`${DOMAIN}/bot`);

// Monitoring route
app.get('/', (req, res) => {
    res.send('Bot ishga tushdi ✅');
});

// Foydalanuvchilarni yuklash/saqlash
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
    console.log('📥 Foydalanuvchi ro‘yxatga olindi:', users[userId]);
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
        console.log('📷 Rasm yuborildi (savol boshlanishi):', current);

        const msg = await ctx.reply('Qaysi stanok uchun xizmat ko'rsatildi?', {
            reply_markup: {
                keyboard: Array.from({ length: 68 }, (_, i) => [{ text: `${i + 1}` }]),
                resize_keyboard: true
            }
        });
        saveMessageId(userId, msg.message_id);
        console.log('❓ Stanok so‘rovi yuborildi');
    } catch (e) {
        console.log("Xatolik survey boshlashda:", e);
        users[userId].processing = false;
    }
}

loadUsers();

bot.on('message', (ctx) => {
    console.log('📥 Kiruvchi xabar:', ctx.message);
});

bot.start((ctx) => {
    const userId = ctx.from.id;
    registerUser(ctx.from);

    if (userId === adminId) {
        console.log('👑 Admin start bosdi');
        return ctx.reply('🤖 Xush kelibsiz, hurmatli admin!', {
            reply_markup: {
                keyboard: [
                    ['👨‍🔧 Ustalar faoliyati'],
                    ['📋 Foydalanuvchilar ro'yxatini ko'rish']
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

        console.log('🚫 Foydalanuvchiga ruxsat yo‘q:', userId);
        return ctx.reply('👋 Xush kelibsiz!\n❌ Sizga hali ruxsat berilmagan. Iltimos, admin ruxsatini kuting.', {
            reply_markup: { remove_keyboard: true }
        });
    }

    console.log('✅ Ruxsatli foydalanuvchi start bosdi:', userId);
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
    console.log('📸 Rasm qabul qilindi:', photoId);

    if (!users[userId].processing && !users[userId].current) {
        deletePreviousMessages(ctx, userId);
        await startSurvey(ctx, userId);
    }
});

// Express serverni ishga tushurish
app.listen(PORT, () => {
    console.log(`🌐 Bot ishga tushdi (webhook mode): http://localhost:${PORT}`);
});
