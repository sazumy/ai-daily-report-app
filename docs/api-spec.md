# API仕様書

## 基本仕様

| 項目 | 内容 |
|------|------|
| Base URL | `/api` |
| データ形式 | JSON |
| 文字コード | UTF-8 |
| 認証方式 | セッション認証（Cookie） |

### 共通レスポンスヘッダー

```
Content-Type: application/json
```

### 共通エラーレスポンス

| HTTPステータス | 意味 | 発生ケース |
|--------------|------|-----------|
| 400 Bad Request | リクエスト不正 | バリデーションエラー |
| 401 Unauthorized | 未認証 | 未ログイン |
| 403 Forbidden | 権限なし | 他人のリソースへのアクセス、ロール不一致 |
| 404 Not Found | リソースなし | 存在しないID |
| 422 Unprocessable Entity | 業務エラー | 重複日報など |
| 500 Internal Server Error | サーバーエラー | - |

**エラーレスポンスボディ（共通）**

```json
{
  "error": {
    "message": "エラーの概要メッセージ",
    "details": [
      { "field": "フィールド名", "message": "フィールドごとのエラーメッセージ" }
    ]
  }
}
```

> `details` はバリデーションエラー（400）時のみ含む。

---

## エンドポイント一覧

| # | メソッド | URL | 概要 | 必要ロール |
|---|---------|-----|------|-----------|
| 1 | POST | `/api/auth/login` | ログイン | 全員 |
| 2 | DELETE | `/api/auth/logout` | ログアウト | 全員 |
| 3 | GET | `/api/auth/me` | ログインユーザー取得 | 全員 |
| 4 | GET | `/api/reports` | 日報一覧取得 | 全員 |
| 5 | POST | `/api/reports` | 日報作成 | 営業担当者 |
| 6 | GET | `/api/reports/:id` | 日報詳細取得 | 全員 |
| 7 | PATCH | `/api/reports/:id` | 日報更新 | 営業担当者（自分の日報のみ） |
| 8 | POST | `/api/reports/:id/comments` | コメント追加 | 上長 |
| 9 | GET | `/api/customers` | 顧客一覧取得 | 全員 |
| 10 | POST | `/api/customers` | 顧客作成 | 全員 |
| 11 | PATCH | `/api/customers/:id` | 顧客更新 | 全員 |

---

## 各エンドポイントの詳細

---

### 1. POST `/api/auth/login`

**概要:** メールアドレスとパスワードで認証し、セッションを開始する。

#### リクエストボディ

```json
{
  "email": "taro@example.com",
  "password": "password123"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| email | string | ✓ | メール形式 |
| password | string | ✓ | 1文字以上 |

#### レスポンス

**成功 `200 OK`**

```json
{
  "user": {
    "id": 1,
    "name": "山田 太郎",
    "email": "taro@example.com",
    "role": "salesperson"
  }
}
```

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — メール・パスワード不一致

---

### 2. DELETE `/api/auth/logout`

**概要:** セッションを終了する。

#### リクエストボディ

なし

#### レスポンス

**成功 `204 No Content`**

**エラー `401 Unauthorized`** — 未ログイン

---

### 3. GET `/api/auth/me`

**概要:** 現在ログイン中のユーザー情報を返す。

#### リクエストボディ

なし

#### レスポンス

**成功 `200 OK`**

```json
{
  "user": {
    "id": 1,
    "name": "山田 太郎",
    "email": "taro@example.com",
    "role": "salesperson"
  }
}
```

**エラー `401 Unauthorized`** — 未ログイン

---

### 4. GET `/api/reports`

**概要:** 日報一覧を取得する。営業担当者は自分の日報のみ返す。上長は全員分を返す。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 備考 |
|-----------|-----|:----:|------|
| from | string (date) | - | 絞り込み開始日。形式: `YYYY-MM-DD` |
| to | string (date) | - | 絞り込み終了日。形式: `YYYY-MM-DD` |
| user_id | integer | - | 担当者フィルタ。**上長のみ有効**（営業担当者が指定しても無視） |

#### レスポンス

**成功 `200 OK`**

```json
{
  "reports": [
    {
      "id": 10,
      "report_date": "2026-03-19",
      "user": {
        "id": 1,
        "name": "山田 太郎"
      },
      "problem": "〇〇社の予算感が掴めていない",
      "comments_count": 2
    },
    ...
  ]
}
```

**バリデーション**

| ケース | ステータス |
|--------|-----------|
| `from` > `to` | `400 Bad Request` |

**エラー `401 Unauthorized`** — 未ログイン

---

### 5. POST `/api/reports`

**概要:** 日報を新規作成する。営業担当者のみ実行可能。

#### リクエストボディ

```json
{
  "report_date": "2026-03-19",
  "visit_records": [
    {
      "customer_id": 3,
      "content": "新製品の提案を実施。先方の反応は良好。"
    },
    {
      "customer_id": 7,
      "content": "契約更新の意向を確認。来週正式回答予定。"
    }
  ],
  "problem": "〇〇社の担当者が変わり、関係構築をゼロから始める必要がある。",
  "plan": "〇〇社へのフォローアップメールを送付する。"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| report_date | string (date) | ✓ | `YYYY-MM-DD`形式。本日の日付のみ受け付ける |
| visit_records | array | - | 空配列可 |
| visit_records[].customer_id | integer | ✓（要素が存在する場合） | 存在する顧客IDであること |
| visit_records[].content | string | ✓（要素が存在する場合） | 1文字以上1000文字以内 |
| problem | string | - | 2000文字以内 |
| plan | string | - | 2000文字以内 |

#### レスポンス

**成功 `201 Created`**

```json
{
  "report": {
    "id": 10,
    "report_date": "2026-03-19",
    "user": {
      "id": 1,
      "name": "山田 太郎"
    },
    "visit_records": [
      {
        "id": 5,
        "customer": {
          "id": 3,
          "name": "鈴木 一郎",
          "company_name": "株式会社ABC"
        },
        "content": "新製品の提案を実施。先方の反応は良好。"
      }
    ],
    "problem": "〇〇社の担当者が変わり、関係構築をゼロから始める必要がある。",
    "plan": "〇〇社へのフォローアップメールを送付する。",
    "comments": [],
    "created_at": "2026-03-19T10:00:00+09:00",
    "updated_at": "2026-03-19T10:00:00+09:00"
  }
}
```

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — 未ログイン
**エラー `403 Forbidden`** — 上長によるリクエスト
**エラー `422 Unprocessable Entity`** — 当日の日報が既に存在する

---

### 6. GET `/api/reports/:id`

**概要:** 日報の詳細を取得する。訪問記録・コメントを含む。

#### パスパラメータ

| パラメータ | 型 | 備考 |
|-----------|-----|------|
| id | integer | 日報ID |

#### レスポンス

**成功 `200 OK`**

```json
{
  "report": {
    "id": 10,
    "report_date": "2026-03-19",
    "user": {
      "id": 1,
      "name": "山田 太郎"
    },
    "visit_records": [
      {
        "id": 5,
        "customer": {
          "id": 3,
          "name": "鈴木 一郎",
          "company_name": "株式会社ABC"
        },
        "content": "新製品の提案を実施。先方の反応は良好。"
      }
    ],
    "problem": "〇〇社の担当者が変わり、関係構築をゼロから始める必要がある。",
    "plan": "〇〇社へのフォローアップメールを送付する。",
    "comments": [
      {
        "id": 2,
        "commenter": {
          "id": 4,
          "name": "佐藤 部長"
        },
        "body": "〇〇社の件、来週私も同行します。",
        "created_at": "2026-03-19T18:30:00+09:00"
      }
    ],
    "created_at": "2026-03-19T10:00:00+09:00",
    "updated_at": "2026-03-19T10:00:00+09:00"
  }
}
```

**エラー `401 Unauthorized`** — 未ログイン
**エラー `404 Not Found`** — 存在しないID

---

### 7. PATCH `/api/reports/:id`

**概要:** 日報を更新する。自分の日報のみ更新可能。

#### パスパラメータ

| パラメータ | 型 | 備考 |
|-----------|-----|------|
| id | integer | 日報ID |

#### リクエストボディ

```json
{
  "visit_records": [
    {
      "id": 5,
      "customer_id": 3,
      "content": "新製品の提案を実施。先方の反応は良好。次回デモを依頼された。"
    },
    {
      "customer_id": 8,
      "content": "初回訪問。担当者名刺交換のみ。"
    }
  ],
  "problem": "〇〇社の担当者交代への対応が急務。",
  "plan": "〇〇社へのフォローアップメールを送付する。△△社の資料を準備する。"
}
```

> `visit_records` は**差分ではなく全件洗い替え**とする。
> 既存レコードには `id` を含めて送信する。`id` がない要素は新規追加として扱う。
> リクエストに含まれていない既存レコードは削除される。

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| visit_records | array | - | 空配列可 |
| visit_records[].id | integer | - | 指定する場合は自分の日報に紐づく既存IDであること |
| visit_records[].customer_id | integer | ✓（要素が存在する場合） | 存在する顧客IDであること |
| visit_records[].content | string | ✓（要素が存在する場合） | 1文字以上1000文字以内 |
| problem | string | - | 2000文字以内 |
| plan | string | - | 2000文字以内 |

#### レスポンス

**成功 `200 OK`** — レスポンスボディは `GET /api/reports/:id` と同じ形式

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — 未ログイン
**エラー `403 Forbidden`** — 他人の日報、または上長によるリクエスト
**エラー `404 Not Found`** — 存在しないID

---

### 8. POST `/api/reports/:id/comments`

**概要:** 日報にコメントを追加する。上長のみ実行可能。

#### パスパラメータ

| パラメータ | 型 | 備考 |
|-----------|-----|------|
| id | integer | 日報ID |

#### リクエストボディ

```json
{
  "body": "〇〇社の件、来週私も同行します。"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| body | string | ✓ | 1文字以上1000文字以内 |

#### レスポンス

**成功 `201 Created`**

```json
{
  "comment": {
    "id": 3,
    "commenter": {
      "id": 4,
      "name": "佐藤 部長"
    },
    "body": "〇〇社の件、来週私も同行します。",
    "created_at": "2026-03-19T18:30:00+09:00"
  }
}
```

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — 未ログイン
**エラー `403 Forbidden`** — 営業担当者によるリクエスト
**エラー `404 Not Found`** — 存在しない日報ID

---

### 9. GET `/api/customers`

**概要:** 顧客一覧を取得する。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 備考 |
|-----------|-----|:----:|------|
| q | string | - | 顧客名・会社名の部分一致検索 |

#### レスポンス

**成功 `200 OK`**

```json
{
  "customers": [
    {
      "id": 3,
      "name": "鈴木 一郎",
      "company_name": "株式会社ABC",
      "phone": "03-1234-5678",
      "address": "東京都渋谷区〇〇1-2-3"
    },
    ...
  ]
}
```

**エラー `401 Unauthorized`** — 未ログイン

---

### 10. POST `/api/customers`

**概要:** 顧客を新規作成する。

#### リクエストボディ

```json
{
  "name": "鈴木 一郎",
  "company_name": "株式会社ABC",
  "phone": "03-1234-5678",
  "address": "東京都渋谷区〇〇1-2-3"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| name | string | ✓ | 1文字以上100文字以内 |
| company_name | string | - | 100文字以内 |
| phone | string | - | 20文字以内。数字・ハイフンのみ |
| address | string | - | 255文字以内 |

#### レスポンス

**成功 `201 Created`**

```json
{
  "customer": {
    "id": 3,
    "name": "鈴木 一郎",
    "company_name": "株式会社ABC",
    "phone": "03-1234-5678",
    "address": "東京都渋谷区〇〇1-2-3",
    "created_at": "2026-03-19T10:00:00+09:00",
    "updated_at": "2026-03-19T10:00:00+09:00"
  }
}
```

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — 未ログイン

---

### 11. PATCH `/api/customers/:id`

**概要:** 顧客情報を更新する。

#### パスパラメータ

| パラメータ | 型 | 備考 |
|-----------|-----|------|
| id | integer | 顧客ID |

#### リクエストボディ

```json
{
  "name": "鈴木 一郎",
  "company_name": "株式会社ABC",
  "phone": "03-9999-0000",
  "address": "東京都新宿区△△4-5-6"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|:----:|-------------|
| name | string | ✓ | 1文字以上100文字以内 |
| company_name | string | - | 100文字以内 |
| phone | string | - | 20文字以内。数字・ハイフンのみ |
| address | string | - | 255文字以内 |

#### レスポンス

**成功 `200 OK`**

```json
{
  "customer": {
    "id": 3,
    "name": "鈴木 一郎",
    "company_name": "株式会社ABC",
    "phone": "03-9999-0000",
    "address": "東京都新宿区△△4-5-6",
    "created_at": "2026-03-19T10:00:00+09:00",
    "updated_at": "2026-03-19T15:00:00+09:00"
  }
}
```

**エラー `400 Bad Request`** — バリデーションエラー
**エラー `401 Unauthorized`** — 未ログイン
**エラー `404 Not Found`** — 存在しないID
