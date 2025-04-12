// bot.js — YANGILANGAN TO‘LIQ KOD

const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express'); // <<< Qo'shildi

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminId = parseInt(process.env.ADMIN_ID);

// === Render uchun express server ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot ishlayapti');
});

app.listen(PORT, () => {
  console.log(`Web server ${PORT}-portda ishlayapti`);
});

// === Bot kodlari ===
const USERS_FILE = 'users.json';
let users = {};
let userMessageIds = {};
let userFinalMessageId = {};
const technicianLogs = {
    'K.Abdufatto': [],
    'A.Saidakbar': []
};

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

// Bot buyruqlar va eventlar shu yerda davom etadi...

bot.launch();
