const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Đường dẫn Webhook gửi tin nhắn vào nhóm SeaTalk của bạn
const SEATALK_WEBHOOK_URL = "https://openapi.seatalk.io/webhook/group/nzILNwSCRn6NKRzzoi7RIg";

// Bộ nhớ tạm lưu danh sách order
let orderList = [];

app.post('/seatalk-webhook', async (req, res) => {
    const data = req.body || {};

    // 1. BẮT BỘC: Phản hồi Challenge để SeaTalk vượt qua bước kiểm tra "Verification Test"
    if (data.event_type === 'event_verification' || data.challenge) {
        return res.status(200).json({ challenge: data.challenge });
    }

    // 2. Xử lý khi có tin nhắn gửi tới Bot trong nhóm
    if (data.event_type === 'message_from_bot_subscriber' || data.event_type === 'group_message') {
        const message = data.event?.message || {};
        const textContent = message.text ? message.text.content : '';
        const senderName = data.event?.sender?.name || "Đồng nghiệp";

        // Xóa thẻ tag bot (<at id="...">...</at>) khỏi nội dung tin nhắn
        const cleanText = textContent.replace(/<at id=".*?">.*?<\/at>/g, '').trim();
        const lowerText = cleanText.toLowerCase();

        // Xử lý các câu lệnh điều khiển
        if (lowerText === "danh sách" || lowerText === "ds") {
            await sendGroupMessage(renderOrderList());
        } 
        else if (lowerText === "xóa đơn" || lowerText === "xoa don") {
            orderList = orderList.filter(item => item.sender !== senderName);
            await sendGroupMessage(`❌ Đã xóa đơn của **${senderName}**.\n\n` + renderOrderList());
        } 
        else if (lowerText === "chốt đơn" || lowerText === "chot don") {
            const finalMsg = "🔒 **ĐÃ CHỐT ĐƠN HỒNG TRÀ NGÔ GIA!** 🔒\n" + renderOrderList();
            await sendGroupMessage(finalMsg);
            orderList = []; // Reset danh sách sau khi chốt
        } 
        else if (cleanText.length > 0) {
            // Tách cú pháp: [Tên món] - [Ghi chú/Topping] - [Số lượng]
            // Ví dụ: Hồng trà kem tươi - 50% đường, trân châu - 2
            const parts = cleanText.split('-').map(p => p.trim());

            if (parts.length >= 1) {
                const mon = parts[0];
                let note = 'Mặc định';
                let soLuong = 1;

                if (parts.length === 2) {
                    // Cú pháp 2 phần: Món - Số lượng HOẶC Món - Ghi chú
                    if (!isNaN(parts[1])) {
                        soLuong = parseInt(parts[1], 10);
                    } else {
                        note = parts[1];
                    }
                } else if (parts.length >= 3) {
                    // Cú pháp 3 phần: Món - Ghi chú - Số lượng
                    note = parts[1];
                    soLuong = parseInt(parts[parts.length - 1], 10) || 1;
                }

                // Thêm vào danh sách order
                orderList.push({
                    sender: senderName,
                    mon: note !== 'Mặc định' ? `${mon} (${note})` : mon,
                    soLuong: soLuong
                });

                await sendGroupMessage(`✅ **Đã ghi nhận order từ ${senderName}!**\n\n` + renderOrderList());
            }
        }
    }

    // Phản hồi OK cho SeaTalk
    res.status(200).send('OK');
});

// Hàm tạo giao diện danh sách đơn hàng
function renderOrderList() {
    if (orderList.length === 0) {
        return "📋 Danh sách order hiện tại đang trống.";
    }

    let totalItems = 0;
    let listText = "📝 **DANH SÁCH ORDER HỒNG TRÀ NGÔ GIA:**\n-------------------------------\n";

    orderList.forEach((item, index) => {
        totalItems += item.soLuong;
        listText += `${index + 1}. **${item.sender}**: ${item.mon} x **${item.soLuong}**\n`;
    });

    listText += `-------------------------------\n📊 **Tổng cộng:** ${totalItems} ly.`;
    return listText;
}

// Hàm gửi tin nhắn tự động vào nhóm chat SeaTalk
async function sendGroupMessage(text) {
    try {
        await axios.post(SEATALK_WEBHOOK_URL, {
            tag: "text",
            text: { content: text }
        });
    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn vào SeaTalk:", error.message);
    }
}

// Khởi chạy server trên cổng do Render cấp
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server bot trà sữa đang chạy trên port ${PORT}`);
});
