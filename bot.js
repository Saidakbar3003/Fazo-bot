// Kod oxirida joylashtiring

// 🔁 Render redeploy URL
const RENDER_DEPLOY_URL = 'https://api.render.com/deploy/srv-cvt7du95pdvs739h3pj0?key=txzklcHbGFw';

// Admin uchun "Redeploy" tugmasini qo‘shamiz
bot.command('redeploy', (ctx) => {
    if (ctx.from.id !== adminId) return;

    ctx.reply('♻️ Redeploy qilishni tasdiqlang:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '♻️ Redeploy', callback_data: 'do_redeploy' }]
            ]
        }
    });
});

// Tugma bosilganda redeploy qilish
bot.action('do_redeploy', async (ctx) => {
    if (ctx.from.id !== adminId) return ctx.answerCbQuery('Faqat admin ishlata oladi.');

    try {
        await fetch(RENDER_DEPLOY_URL, { method: 'POST' });
        await ctx.answerCbQuery('✅ Redeploy boshlandi');
        await ctx.reply('🛠 Bot redeploy qilinmoqda...');
    } catch (error) {
        console.error('Redeploy xatoligi:', error);
        await ctx.answerCbQuery('❌ Xatolik yuz berdi');
        await ctx.reply('⚠️ Redeploy qilishda xatolik.');
    }
});
