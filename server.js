const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const SEATALK_WEBHOOK_URL = "https://openapi.seatalk.io/webhook/group/nzILNwSCRn6NKRzzoi7RIg";
const SIGNING_SECRET = "YfReAY-h7Po0c0cASQWry_xumS-nyCxq";

let orderList = [];

// Hỗ trợ cả GET để khi mở link trên trình duyệt sẽ không bị lỗi "Cannot GET"
app.get('/seatalk-webhook', (req, res) => {
    res.status(200).send('Server Bot Trà Sữa SeaTalk đang hoạt động bình thường!');
});

app.post('/seatalk-webhook', async (req, res) => {
    const data = req.body || {};

    // 1. TRẢ VỀ CHALLENGE DÙNG ĐỂ XÁC THỰC EVENT CALLBACK URL (BẮT BỘC)
    // Trường hợp 1: SeaTalk gửi event_verification
    if (data.event_type === 'event_verification' && data.event && data.event.challenge) {
        return res.status(200).json({ challenge: data.event.challenge });
    }
    // Trường hợp 2: SeaTalk gửi challenge thẳng ở ngoài
    if (data.challenge) {
        return res.status(200).json({ challenge: data.challenge });
    }

    // 2. XỬ LÝ TIN NHẮN TỪ NHÓM
    try {
        if (data.event_type === 'message_from_bot_subscriber' || data.event_type === 'group_message' || data.event) {
            const message = data.event?.message || {};
            const textContent = message.text ? message.text.content : '';
            const senderName = data.event?.sender?.name || "Đồng nghiệp";

            const cleanText = textContent.replace(/<at id=".*?">.*?<\/at>/g, '').trim();
            const lowerText = cleanText.toLowerCase();

            if (lowerText === "danh sách" || lowerText === "ds") {
                await sendGroupMessage(renderOrderList());
            } else if (lowerText === "xóa đơn" || lowerText === "xoa don") {
                orderList = orderList.filter(item => item.sender !== senderName);
                await sendGroupMessage(`❌ Đã xóa đơn của **${senderName}**.\n\n` + renderOrderList());
            } else if (lowerText === "chốt đơn" || lowerText === "chot don") {
                const finalMsg = "🔒 **ĐÃ CHỐT ĐƠN HỒNG TRÀ NGÔ GIA!** 🔒\n" + renderOrderList();
                await sendGroupMessage(finalMsg);
                orderList = [];
            } else if (cleanText.length > 0) {
                const parts = cleanText.split('-').map(p => p.trim());
                if (parts.length >= 1) {
                    const mon = parts[0];
                    let note = 'Mặc định';
                    let soLuong = 1;

                    if (parts.length === 2) {
                        if (!isNaN(parts[1])) {
                            soLuong = parseInt(parts[1], 10);
                        } else {
                            note = parts[1];
                        }
                    } else if (parts.length >= 3) {
                        note = parts[1];
                        soLuong = parseInt(parts[parts.length - 1], 10) || 1;
                    }

                    orderList.push({
                        sender: senderName,
                        mon: note !== 'Mặc định' ? `${mon} (${note})` : mon,
                        soLuong: soLuong
                    });

                    await sendGroupMessage(`✅ **Đã ghi nhận order từ ${senderName}!**\n\n` + renderOrderList());
                }
            }
        }
    } catch (err) {
        console.error("Lỗi xử lý tin nhắn:", err);
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
        console.error("Lỗi gửi tin nhắn SeaTalk:", error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
