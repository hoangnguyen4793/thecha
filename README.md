# Chấm Công Quán

## Cách chạy

Mở PowerShell trong thư mục này và chạy:

```powershell
node server.js
```

Sau đó mở:

```text
http://localhost:3000
```

## Tài khoản mẫu

- Nhân viên: `NV001 / 1111`, `NV002 / 2222`, `NV003 / 3333`
- Quản trị: `admin / 123456`

## Cơ chế WiFi

WiFi quán đang dùng:

- Tên WiFi: `The -Cha`
- IP thiết bị mẫu: `192.168.1.151`
- Mặt nạ mạng con: `255.255.255.0`
- Bộ định tuyến: `192.168.1.1`
- Dải IP hợp lệ để chấm công: `192.168.1.x`

Trình duyệt không cho website đọc trực tiếp tên WiFi/SSID. Vì vậy máy chủ kiểm tra IP của thiết bị truy cập. Mặc định app đã cấu hình chỉ cho phép dải `192.168.1.`.

Chạy app:

```powershell
node server.js
```

Nếu thiết bị không thuộc dải IP này, API chấm công sẽ từ chối vào ca/ra ca.

Giới hạn WiFi chỉ áp dụng cho tài khoản nhân viên khi bấm vào ca/ra ca. Tài khoản quản trị `admin / 123456` có thể đăng nhập từ bất kỳ mạng nào miễn là truy cập được tới địa chỉ máy chủ.

Nếu sau này router đổi sang dải khác, ví dụ `192.168.100.x`, chạy:

```powershell
$env:CAFE_ALLOWED_IP_PREFIXES="192.168.100."
$env:CAFE_WIFI_NAME="The -Cha"
node server.js
```
