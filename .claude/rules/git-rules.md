# Quy tắc Git — MPMS

Repo: `https://github.com/qnthoanglongcomputer-svg/BCMKT.git` · nhánh chính: `main`

## Nhánh

- Không commit thẳng lên `main` cho công việc đang làm dở.
- Đặt tên nhánh theo dạng `<loại>/<mô-tả-ngắn>`:
  - `feat/kpi-planning`
  - `fix/rollup-ratio-sai-so`
  - `refactor/scope-resolver`
  - `docs/workflows`
- Một nhánh giải quyết một việc. Nhánh sống càng ngắn càng dễ merge.

## Commit

Định dạng:

```
<loại>: <mô tả ngắn bằng tiếng Việt, không dấu chấm cuối>

<thân bài: vì sao thay đổi, không phải thay đổi cái gì —
diff đã nói cái gì rồi>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

Loại: `feat` · `fix` · `refactor` · `docs` · `test` · `chore` · `perf`

Nguyên tắc:

- Mỗi commit là một thay đổi **hoàn chỉnh và chạy được**. Không commit code đang lỗi để "lát nữa sửa".
- Không gom nhiều việc không liên quan vào một commit.
- Không commit file format lại hàng loạt chung với thay đổi logic — người review không tìm ra được đâu là thay đổi thật.
- Ưu tiên tạo commit mới hơn `--amend` commit đã push.

## Tuyệt đối không commit

- `.env` và mọi file chứa connection string, token, API key thật
- `node_modules/`, `.next/`, file build
- File tạm, file export đã sinh ra, log
- Dữ liệu thật của doanh nghiệp (danh sách nhân sự thật, số liệu kinh doanh thật) trong seed

Nếu lỡ commit secret: **đổi secret đó ngay** (rotate), không chỉ xoá khỏi lịch sử. Coi như đã lộ.

## Trước khi push

```bash
npm run typecheck
npm run lint
npm test
```

Không push code làm hỏng các lệnh trên.

## Migration

- File migration đã push **không được sửa**. Sai thì tạo migration mới.
- Migration đi cùng commit với thay đổi code dùng nó — để `git checkout` một commit bất kỳ vẫn chạy được.
- Migration có thay đổi phá vỡ tương thích: nêu rõ trong thân commit, kèm cách rollback.

## Xử lý xung đột

- Rebase lên `main` mới nhất trước khi merge.
- Xung đột ở `package-lock.json`: lấy `main` rồi chạy lại `npm install`, không sửa tay.
- Xung đột ở thư mục migration: **không bao giờ** sửa file migration cũ; tạo migration mới trên nền `main`.

## Thao tác nguy hiểm

Chỉ làm khi người dùng yêu cầu rõ ràng:

- `git push --force` (dùng `--force-with-lease` nếu buộc phải)
- `git reset --hard`
- `git checkout -- <file>` khi có thay đổi chưa lưu
- Xoá nhánh remote

Trước mỗi thao tác trên, nêu rõ cái gì sẽ mất và có cách lùi không.
