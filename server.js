const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Thông tin lấy từ giao diện SeaTalk của bạn
const SEATALK_WEBHOOK_URL = "https://openapi.seatalk.io/webhook/group/nzILNwSCRn6NKRzzoi7RIg";
const SIGNING_SECRET = "YfReAY-h7Po0c0cASQWry_xumS-nyCxq";

let orderList = [];

app.post('/seatalk-webhook', async (req, res) => {
    const data = req.body;

    // Bắt buộc để SeaTalk xác thực URL khi bạn dán link vào
    if (data.event_type === 'event_verification') {
        return res.json({ challenge: data.challenge });
    }

    if (data.event_type === 'message_from_bot_subscriber' || data.event_type === 'group_message') {
        const message = data.event.message || {};
        const textContent = message.text ? message.text.content : '';
        const senderName = data.event.sender ? (data.event.sender.name || "Đồng nghiệp") : "Đồng nghiệp";

        if (textContent.includes("danh sách")) {
            await sendGroupMessage(renderOrderList());
        } else if (textContent.includes("xóa đơn")) {
            orderList = orderList.filter(item => item.sender !== senderName);
            await sendGroupMessage(`❌ Đã xóa đơn của ${senderName}.\n\n` + renderOrderList());
        } else if (textContent.includes("chốt đơn")) {
            const finalMsg = "🔒 **ĐÃ CHỐT ĐƠN HỒNG TRÀ NGÔ GIA!** 🔒\n" + renderOrderList();
            await sendGroupMessage(finalMsg);
            orderList = [];
        } else {
            const cleanText = textContent.replace(/<at id=".*?">.*?<\/at>/g, '').trim();
            const parts = cleanText.split('-').map(p => p.trim());

            if (parts.length >= 2) {
                const mon = parts[0];
                const note = parts.length >= 3 ? parts[1] : 'Mặc định';
                const soLuong = parseInt(parts[parts.length - 1]) || 1;

                orderList.push({
                    sender: senderName,
                    mon: note !== 'Mặc định' ? `${mon} (${note})` : mon,
                    soLuong: soLuong
                });

                await sendGroupMessage(`✅ **Đã ghi nhận order từ ${senderName}!**\n\n` + renderOrderList());
            }
        }
    }

    res.status(200).send('OK');
});

function renderOrderList() {
    if (orderList.length === 0) return "📋 Danh sách order hiện tại đang trống.";
    let totalItems = 0;
    let listText = "📝 **DANH SÁCH ORDER HỒNG TRÀ NGÔ GIA:**\n-------------------------------\n";
    orderList.forEach((item, index) => {
        totalItems += item.soLuong;
        listText += `${index + 1}. **${item.sender}**: ${item.mon} x **${item.soLuong}**\n`;
    });
    listText += `-------------------------------\n📊 **Tổng cộng:** ${totalItems} ly.`;
    return listText;
}

async function sendGroupMessage(text) {
    try {
        await axios.post(SEATALK_WEBHOOK_URL, {
            tag: "text",
            text: { content: text }
        });
    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));