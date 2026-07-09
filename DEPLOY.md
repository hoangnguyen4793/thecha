# Triển khai miễn phí: Render + Supabase

Bản này đã sẵn sàng để đưa lên host. Cách dễ làm và đủ tính năng nhất là:

- Render: chạy website và server Node.js miễn phí.
- Supabase: lưu toàn bộ dữ liệu nhân viên, chấm công, lương, phạt, thưởng miễn phí.

## 1. Tạo bảng lưu dữ liệu trên Supabase

1. Vào Supabase và mở project của bạn.
2. Chọn SQL Editor.
3. Mở file `supabase-schema.sql` trong thư mục dự án này.
4. Copy toàn bộ nội dung file đó, dán vào SQL Editor rồi bấm Run.

Sau bước này Supabase sẽ có bảng `app_state` để lưu dữ liệu của phần mềm.

## 2. Lấy thông tin kết nối Supabase

Trong Supabase, vào Project Settings > API và lấy 2 thông tin:

- Project URL
- service_role key

Lưu ý: `service_role key` là khóa quản trị, không đưa vào code, không đăng công khai. Chỉ nhập khóa này trong phần Environment Variables của host.

## 3. Đưa mã nguồn lên GitHub

Tạo một repository mới trên GitHub, sau đó tải toàn bộ thư mục dự án này lên.

Các file cần có:

- `server.js`
- `index.html`
- `admin.html`
- `app.js`
- `styles.css`
- `data.json`
- `package.json`
- `render.yaml`
- `supabase-schema.sql`
- thư mục `assets`

## 4. Tạo Web Service trên Render

1. Vào Render Dashboard.
2. Chọn New > Web Service.
3. Kết nối repository GitHub vừa tạo.
4. Chọn plan Free.
5. Nếu Render hỏi lệnh chạy, nhập:
   - Build Command: `npm install`
   - Start Command: `npm start`

Nếu Render đọc được file `render.yaml`, các thông tin này sẽ tự có sẵn.

## 5. Nhập Environment Variables trên Render

Trong phần Environment Variables của Web Service, thêm các biến sau:

| Tên biến | Giá trị |
| --- | --- |
| `SUPABASE_URL` | Project URL lấy từ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key lấy từ Supabase |
| `SUPABASE_STATE_KEY` | `cham-cong-quan` |
| `CAFE_WIFI_NAME` | Tên WiFi quán, ví dụ `The -Cha` |
| `CAFE_REQUIRE_WIFI` | `false` |

Ứng dụng hiện không giới hạn theo WiFi/IP nữa. Nhân viên đăng nhập đúng tài khoản là có thể chấm công.

## 6. Deploy

Sau khi nhập đủ biến môi trường, bấm Manual Deploy > Deploy latest commit.

Render sẽ tạo cho bạn một link dạng:

`https://ten-ung-dung.onrender.com`

Đây là link để nhân viên và quản trị viên sử dụng.

## 7. Kiểm tra sau khi deploy

1. Mở link Render.
2. Đăng nhập nhân viên và thử chấm công.
3. Mở trang quản trị bằng nút quản trị ở đầu trang.
4. Đăng nhập admin.
5. Thêm thử nhân viên, phạt, thưởng, sửa giờ chấm công.
6. Tải lại trang để kiểm tra dữ liệu vẫn còn.

Nếu dữ liệu vẫn còn sau khi tải lại trang, Supabase đã hoạt động đúng.

## Tài khoản mặc định

- Admin: `admin / 123456`
- Nhân viên mẫu: `linhtran / 1111`, `minhpham / 2222`, `annguyen / 3333`, `hamy / 4444`

Sau khi triển khai thật, nên đổi mật khẩu admin ngay trong trang quản trị.
