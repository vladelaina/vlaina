# Local Performance Testing

这套压测只默认打本地 Worker 和本地 D1，不会碰远端部署。

## 1. 准备本地 API 环境

在 `api/.dev.vars` 里放本地 admin key：

```dotenv
ADMIN_API_KEY=local_admin_key
DATA_ENCRYPTION_KEY=local_perf_data_key
```

先确保本地 D1 schema 是新的：

```bash
pnpm --dir api db:apply:local
```

如果你想要完全干净的本地库，可以用本地 reset。这个只重置本地 D1：

```bash
pnpm --dir api db:reset:local
```

## 2. 灌压测数据

快速 smoke：

```bash
PERF_PROFILE=smoke pnpm perf:seed:local
```

日常本地压测：

```bash
PERF_PROFILE=medium pnpm perf:seed:local
```

大表压测：

```bash
PERF_PROFILE=heavy pnpm perf:seed:local
```

`heavy` 默认会生成：

```text
users=20000
channels=20
models=5000
auditLogs=250000
activityRows=100000
sessionUsers=500
```

脚本生成并应用 `api/temp/perf-seed.sql`，并写出 `api/temp/perf-seed-metadata.json`。默认会清掉上次 perf seed 的同前缀数据，再 `INSERT OR REPLACE`，所以可以反复跑。

只生成 SQL 不应用：

```bash
PERF_PROFILE=heavy PERF_SEED_APPLY=0 pnpm perf:seed:local
```

自定义数据量：

```bash
PERF_USERS=50000 PERF_MODELS=10000 PERF_AUDIT_LOGS=1000000 PERF_ACTIVITY_ROWS=250000 pnpm perf:seed:local
```

## 3. 启动本地 Worker

```bash
pnpm --dir api dev
```

默认地址通常是 `http://127.0.0.1:8787`。

## 4. 开始压测

另一个终端跑：

```bash
PERF_ADMIN_KEY=local_admin_key PERF_PROFILE=heavy PERF_SCENARIO=mixed pnpm perf:api:local
```

更狠一点：

```bash
PERF_ADMIN_KEY=local_admin_key PERF_PROFILE=heavy PERF_SCENARIO=admin-heavy PERF_CONCURRENCY=300 PERF_DURATION_SECONDS=600 pnpm perf:api:local
```

只压增长分析：

```bash
PERF_ADMIN_KEY=local_admin_key PERF_PROFILE=heavy PERF_SCENARIO=analytics PERF_CONCURRENCY=150 PERF_DURATION_SECONDS=300 pnpm perf:api:local
```

只压真实增长分析页面会用到的接口：

```bash
PERF_ADMIN_KEY=local_admin_key PERF_PROFILE=heavy PERF_SCENARIO=analytics-page PERF_CONCURRENCY=50 PERF_DURATION_SECONDS=300 pnpm perf:api:local
```

只压模型列表：

```bash
PERF_PROFILE=heavy PERF_SCENARIO=models PERF_CONCURRENCY=300 PERF_DURATION_SECONDS=300 pnpm perf:api:local
```

只压预算接口正常登录态路径：

```bash
PERF_PROFILE=heavy PERF_SCENARIO=budget PERF_CONCURRENCY=150 PERF_DURATION_SECONDS=300 pnpm perf:api:local
```

预算场景会自动跟随服务端返回的 `x-app-session-token`，避免 session rotation 后继续拿旧 token 压测。如果本地 D1 已经放了很久，旧 seed session 可能已经过了 grace 窗口，重新跑一次 `PERF_PROFILE=heavy pnpm perf:seed:local` 即可。

## 场景

```text
public          /v1/models + /v1/models/version
models          /v1/models
budget          /v1/budget，使用 seed 生成的本地 app session
analytics       admin 增长分析、overview、top users/models、用户明细
analytics-page  admin 增长分析真实页面主接口、用户列表弹窗、用户明细
admin-tables    admin 用户、日志、模型、渠道、系统健康
admin-open      模拟打开 admin 分组首页：用户/日志首页、模型前两页、渠道、系统健康
admin-models    只压 admin 模型列表前两页
admin-users     只压 admin 用户列表常用前几页
admin-logs      只压 admin 日志列表常用前几页
admin-heavy     更偏 admin analytics + admin tables
mixed           public + budget + admin analytics + admin tables
managed-client  模拟客户端模型目录缓存：高频查版本，低频拉完整模型列表
mixed-open      raw public + budget + 真实增长分析页面 + 真实 admin 分组打开路径
mixed-open-client  客户端缓存口径 public + budget + 真实增长分析页面 + 真实 admin 分组打开路径
```

## 常用参数

```text
PERF_BASE_URL              默认 http://127.0.0.1:8787
PERF_PROFILE               smoke | medium | heavy
PERF_SCENARIO              mixed | mixed-open | mixed-open-client | managed-client | admin-heavy | analytics | admin-open | admin-tables | admin-models | admin-users | admin-logs | models | budget | public
PERF_CONCURRENCY           并发数
PERF_DURATION_SECONDS      正式压测秒数
PERF_WARMUP_SECONDS        预热秒数
PERF_TIMEOUT_MS            单请求超时
PERF_ROTATE_IPS            默认 1，轮换 CF-Connecting-IP 绕过单 IP 限流测后端
PERF_JSON                  设为 1 输出 JSON
PERF_FAIL_ON_BUDGET        设为 1 后按错误率或 p95 budget 失败退出
PERF_P95_BUDGET_MS         p95 阈值，配合 PERF_FAIL_ON_BUDGET
```

默认会拒绝非本地 URL。确实要打非本地地址时必须显式加：

```bash
PERF_ALLOW_REMOTE=1
```

不要用它打生产环境。
