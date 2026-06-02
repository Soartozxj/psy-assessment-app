/**
 * ops-manual-data.js - 运维手册数据模块
 *
 * 解决 P1-2: 将运维手册内容从 admin-legacy.html 分离出来
 * 这样便于独立维护和更新运维手册内容
 *
 * @version 1.0.0
 * @date 2026-05-20
 */

(function (global) {
  'use strict';

  // ====================================================
  // 运维手册章节数据
  // ====================================================
  var OPS_MANUAL_SECTIONS = [
    {
      id: 'overview',
      title: '1. 系统全景图',
      icon: '🗺️',
      html:
        '<h2>系统全景图</h2>' +
        '<pre>用户 ──→ 微信小程序（壳）──→ WebView 加载 H5 页面\n            │                    │\n            │                    ├─ rich.soarto.com.cn（H5 静态页面）\n            │                    └─ identity.soarto.com.cn（API 服务）\n            │\n            ├─ 云函数（data-user 等）\n            ├─ 云数据库（scales / history / config）\n            └─ 静态网站托管（deploy/ 文件）\n\n独立 Web 端：www.soarto.com.cn（腾讯云轻量服务器）</pre>' +
        '<h3>关键 ID 一览</h3>' +
        '<table><tr><th>项目</th><th>值</th></tr>' +
        '<tr><td>小程序 AppID</td><td><code>wxb811fa4c960b0e0b</code></td></tr>' +
        '<tr><td>云开发环境 ID</td><td><code>cloud1-d8ggx8sqde8afa6a4</code></td></tr>' +
        '<tr><td>企业主体</td><td>湖北索拓星蓝科技有限公司</td></tr>' +
        '<tr><td>管理员 OpenID</td><td><code>oyORU3XImvO_rYAWBUTMNm89-3v0</code></td></tr>' +
        '</table>'
    },

    {
      id: 'accounts',
      title: '2. 平台账号清单',
      icon: '🔑',
      html:
        '<h2>平台账号清单</h2>' +
        '<h3>2.1 微信公众平台</h3>' +
        '<table><tr><th>项目</th><th>详情</th></tr>' +
        '<tr><td>入口</td><td><a href="https://mp.weixin.qq.com" target="_blank">mp.weixin.qq.com</a></td></tr>' +
        '<tr><td>登录方式</td><td>扫码登录</td></tr>' +
        '<tr><td>账号类型</td><td>服务号（企业主体）</td></tr>' +
        '<tr><td>AppID</td><td><code>wxb811fa4c960b0e0b</code></td></tr>' +
        '</table>' +
        '<h4>关键菜单位置</h4>' +
        '<table><tr><th>功能</th><th>路径</th></tr>' +
        '<tr><td>微信认证状态</td><td>设置 → 基本设置 → 微信认证</td></tr>' +
        '<tr><td>业务域名</td><td>设置 → 基本设置 → 业务域名</td></tr>' +
        '<tr><td>服务器域名</td><td>开发管理 → 开发设置 → 服务器域名</td></tr>' +
        '<tr><td>隐私保护指引</td><td>设置 → 基本设置 → 隐私保护指引</td></tr>' +
        '<tr><td>代码审核提交</td><td>管理 → 版本管理 → 提交审核</td></tr>' +
        '<tr><td>云开发控制台</td><td>开发管理 → 云开发</td></tr>' +
        '</table>' +
        '<h3>2.2 微信开发者工具</h3>' +
        '<table><tr><th>项目</th><th>详情</th></tr>' +
        '<tr><td>用途</td><td>本地开发、调试、上传代码</td></tr>' +
        '<tr><td>项目路径</td><td><code>wechat-miniprogram/</code></td></tr>' +
        '<tr><td>AppID</td><td><code>wxb811fa4c960b0e0b</code></td></tr>' +
        '</table>' +
        '<h3>2.3 腾讯云（微信云开发）</h3>' +
        '<table><tr><th>项目</th><th>详情</th></tr>' +
        '<tr><td>入口</td><td><a href="https://console.cloud.tencent.com/tcb" target="_blank">腾讯云云开发</a></td></tr>' +
        '<tr><td>环境 ID</td><td><code>cloud1-d8ggx8sqde8afa6a4</code></td></tr>' +
        '<tr><td>套餐</td><td>标准版（连续包月 199 元/月）</td></tr>' +
        '<tr><td>用途</td><td>云数据库、云函数、静态网站托管、云托管</td></tr>' +
        '</table>' +
        '<h4>关键子服务</h4>' +
        '<table><tr><th>服务</th><th>控制台路径</th></tr>' +
        '<tr><td>云数据库</td><td>云开发 → 数据库</td></tr>' +
        '<tr><td>云函数</td><td>云开发 → 云函数</td></tr>' +
        '<tr><td>静态网站托管</td><td>云开发 → 静态网站托管</td></tr>' +
        '<tr><td>云托管</td><td>云开发 → 云托管</td></tr>' +
        '</table>' +
        '<h3>2.4 腾讯云轻量应用服务器</h3>' +
        '<table><tr><th>项目</th><th>详情</th></tr>' +
        '<tr><td>入口</td><td><a href="https://console.cloud.tencent.com/lighthouse" target="_blank">腾讯云轻量服务器</a></td></tr>' +
        '<tr><td>公网 IP</td><td><code>101.43.43.125</code></td></tr>' +
        '<tr><td>操作系统</td><td>OpenCloudOS</td></tr>' +
        '<tr><td>宝塔面板</td><td><code>http://101.43.43.125:8888/tencentcloud</code></td></tr>' +
        '<tr><td>用途</td><td>独立 Web 端部署（www.soarto.com.cn）</td></tr>' +
        '</table>' +
        '<h4>宝塔面板关键配置</h4>' +
        '<table><tr><th>功能</th><th>位置</th></tr>' +
        '<tr><td>网站管理</td><td>网站 → 添加站点 / 管理</td></tr>' +
        "<tr><td>SSL 证书</td><td>网站 → 对应站点 → SSL → Let's Encrypt</td></tr>" +
        '<tr><td>文件管理</td><td>文件 → <code>/www/wwwroot/www.soarto.com.cn</code></td></tr>' +
        '<tr><td>数据库</td><td>数据库 → phpMyAdmin</td></tr>' +
        '</table>' +
        '<h3>2.5 阿里云（域名管理）</h3>' +
        '<table><tr><th>项目</th><th>详情</th></tr>' +
        '<tr><td>入口</td><td><a href="https://dc.console.aliyun.com" target="_blank">阿里云域名管理</a></td></tr>' +
        '<tr><td>用途</td><td>域名注册、DNS 解析、SSL 证书</td></tr>' +
        '<tr><td>域名</td><td><code>soarto.com.cn</code></td></tr>' +
        '</table>'
    },

    {
      id: 'dns',
      title: '3. 域名体系与 DNS',
      icon: '🌐',
      html:
        '<h2>域名体系与 DNS 解析</h2>' +
        '<h3>3.1 域名清单</h3>' +
        '<table><tr><th>域名</th><th>用途</th><th>DNS</th></tr>' +
        '<tr><td><code>soarto.com.cn</code></td><td>主域名</td><td>阿里云</td></tr>' +
        '<tr><td><code>rich.soarto.com.cn</code></td><td>H5 静态页面</td><td>阿里云</td></tr>' +
        '<tr><td><code>identity.soarto.com.cn</code></td><td>云托管 API</td><td>阿里云</td></tr>' +
        '<tr><td><code>www.soarto.com.cn</code></td><td>独立 Web 端</td><td>阿里云</td></tr>' +
        '</table>' +
        '<h3>3.2 DNS 解析记录</h3>' +
        '<h4>rich.soarto.com.cn</h4>' +
        '<table><tr><th>类型</th><th>主机</th><th>记录值</th></tr>' +
        '<tr><td>CNAME</td><td>rich</td><td><code>cloud1-d8ggx8sqde8afa6a4.tcloudbaseapp.com</code></td></tr>' +
        '</table>' +
        '<h4>identity.soarto.com.cn</h4>' +
        '<table><tr><th>类型</th><th>主机</th><th>记录值</th></tr>' +
        '<tr><td>CNAME</td><td>identity</td><td><code>identity.soarto.com.cn.tcbaccess.tencentcloudbase.com</code></td></tr>' +
        '</table>' +
        '<h4>www.soarto.com.cn</h4>' +
        '<table><tr><th>类型</th><th>主机</th><th>记录值</th></tr>' +
        '<tr><td>A</td><td>www</td><td><code>101.43.43.125</code></td></tr>' +
        '</table>' +
        '<blockquote><p>注意：1 个域名只能绑定 1 个云托管服务，所以 rich 和 identity 分别用两个子域名。</p></blockquote>' +
        '<h3>3.3 域名校验文件</h3>' +
        '<p>微信小程序业务域名验证文件（必须放在 rich.soarto.com.cn 根目录）：</p>' +
        '<table><tr><th>文件名</th><th>内容</th></tr>' +
        '<tr><td><code>fQJW4aYeSL.txt</code></td><td><code>369ce7084eb9405844f1fcb37a749865</code></td></tr>' +
        '</table>' +
        '<blockquote><p>切勿删除！删了微信业务域名校验会失败。</p></blockquote>'
    },

    {
      id: 'ssl',
      title: '4. SSL 证书管理',
      icon: '🔐',
      html:
        '<h2>SSL 证书管理</h2>' +
        '<h3>4.1 证书清单</h3>' +
        '<table><tr><th>域名</th><th>来源</th><th>到期</th><th>续期</th></tr>' +
        '<tr><td><code>rich.soarto.com.cn</code></td><td>微信云开发</td><td>2026-07-20</td><td>自动</td></tr>' +
        '<tr><td><code>identity.soarto.com.cn</code></td><td>阿里云 DV</td><td>2026-07-23</td><td>手动</td></tr>' +
        '<tr><td><code>www.soarto.com.cn</code></td><td>待申请</td><td>—</td><td>—</td></tr>' +
        '</table>' +
        '<h3>4.2 续期 identity.soarto.com.cn 证书</h3>' +
        '<ol><li>登录阿里云控制台 → SSL 证书</li>' +
        '<li>找到 identity.soarto.com.cn 的证书</li>' +
        '<li>到期前 30 天申请免费续签</li>' +
        '<li>下载后到云开发控制台 → 云托管 → 服务设置 → 更新证书</li></ol>' +
        '<h3>4.3 www.soarto.com.cn 申请 SSL</h3>' +
        '<blockquote><p>重要：必须在 ICP 接入备案审核通过后才能申请！<br>' +
        "备案通过后：宝塔面板 → 网站 → SSL → Let's Encrypt → 申请 → 开启强制 HTTPS</p></blockquote>"
    },

    {
      id: 'miniprogram',
      title: '5. 微信小程序配置',
      icon: '📱',
      html:
        '<h2>微信小程序配置</h2>' +
        '<h3>5.1 基本配置</h3>' +
        '<table><tr><th>配置项</th><th>值</th></tr>' +
        '<tr><td>AppID</td><td><code>wxb811fa4c960b0e0b</code></td></tr>' +
        '<tr><td>基础库版本</td><td>2.25.4</td></tr>' +
        '<tr><td>导航栏标题</td><td>星蓝心镜</td></tr>' +
        '<tr><td>导航栏颜色</td><td><code>#4A90D9</code></td></tr>' +
        '</table>' +
        '<h3>5.2 业务域名</h3>' +
        '<table><tr><th>域名</th><th>校验文件</th></tr>' +
        '<tr><td><code>rich.soarto.com.cn</code></td><td><code>fQJW4aYeSL.txt</code>（已通过）</td></tr>' +
        '</table>' +
        '<h3>5.3 隐私保护指引</h3>' +
        '<p>需要声明的第三方 SDK：</p>' +
        '<table><tr><th>SDK 名称</th><th>用途</th></tr>' +
        '<tr><td>阿里云 DashScope</td><td>AI 诊断功能</td></tr>' +
        '</table>' +
        '<blockquote><p>注意：不要重复添加。</p></blockquote>' +
        '<h3>5.4 代码审核与发布</h3>' +
        '<ol><li><strong>上传代码</strong>：微信开发者工具 → 上传（填写版本号和备注）</li>' +
        '<li><strong>提交审核</strong>：公众平台 → 管理 → 版本管理 → 提交审核</li>' +
        '<li><strong>审核通过</strong>：管理 → 版本管理 → 全量发布</li>' +
        '<li><strong>前提条件</strong>：微信认证必须通过</li></ol>'
    },

    {
      id: 'cloudbase',
      title: '6. 微信云开发配置',
      icon: '☁️',
      html:
        '<h2>微信云开发配置</h2>' +
        '<h3>6.1 环境信息</h3>' +
        '<table><tr><th>项目</th><th>值</th></tr>' +
        '<tr><td>环境 ID</td><td><code>cloud1-d8ggx8sqde8afa6a4</code></td></tr>' +
        '<tr><td>套餐</td><td>标准版（连续包月 199 元/月）</td></tr>' +
        '<tr><td>控制台入口</td><td>公众平台 → 开发管理 → 云开发</td></tr>' +
        '</table>' +
        '<h3>6.2 云数据库集合</h3>' +
        '<table><tr><th>集合名</th><th>用途</th><th>权限</th></tr>' +
        '<tr><td><code>scales</code></td><td>量表配置数据</td><td>管理员读写</td></tr>' +
        '<tr><td><code>history</code></td><td>测评历史记录</td><td>按 openid 筛选</td></tr>' +
        '<tr><td><code>config</code></td><td>系统配置（含 ai_config）</td><td>管理员读写</td></tr>' +
        '</table>' +
        '<h3>6.3 云函数</h3>' +
        '<table><tr><th>函数名</th><th>用途</th><th>调用时机</th></tr>' +
        '<tr><td><code>data-user</code></td><td>获取用户 OpenID</td><td>小程序启动</td></tr>' +
        '<tr><td><code>data-init</code></td><td>初始化量表数据</td><td>首次部署</td></tr>' +
        '<tr><td><code>data-sync</code></td><td>同步前后端数据</td><td>后台操作</td></tr>' +
        '<tr><td><code>data-save</code></td><td>保存测评结果</td><td>提交测评</td></tr>' +
        '<tr><td><code>data-history</code></td><td>查询历史记录</td><td>查看记录</td></tr>' +
        '<tr><td><code>data-init-force</code></td><td>强制初始化数据</td><td>紧急恢复</td></tr>' +
        '<tr><td><code>ai-call</code></td><td>AI 诊断调用</td><td>AI 诊断</td></tr>' +
        '<tr><td><code>file-upload</code></td><td>文件上传</td><td>NPC 图片上传</td></tr>' +
        '<tr><td><code>get-my-openid</code></td><td>获取 OpenID（调试）</td><td>调试</td></tr>' +
        '</table>' +
        '<h3>6.4 静态网站托管</h3>' +
        '<table><tr><th>项目</th><th>说明</th></tr>' +
        '<tr><td>默认域名</td><td><code>cloud1-d8ggx8sqde8afa6a4.tcloudbaseapp.com</code></td></tr>' +
        '<tr><td>自定义域名</td><td><code>rich.soarto.com.cn</code></td></tr>' +
        '<tr><td>默认首页</td><td><code>index.html</code></td></tr>' +
        '<tr><td>文件管理</td><td>手动上传 deploy/ 目录下所有文件</td></tr>' +
        '</table>'
    },

    {
      id: 'cloudrun',
      title: '7. 云托管 API 服务',
      icon: '🚀',
      html:
        '<h2>云托管 API 服务</h2>' +
        '<h3>7.1 基本信息</h3>' +
        '<table><tr><th>项目</th><th>值</th></tr>' +
        '<tr><td>服务名</td><td><code>psy-api</code></td></tr>' +
        '<tr><td>源码目录</td><td><code>cloudbase-run/</code></td></tr>' +
        '<tr><td>访问域名</td><td><code>https://identity.soarto.com.cn</code></td></tr>' +
        '<tr><td>容器镜像</td><td>Node.js 18 Alpine</td></tr>' +
        '<tr><td>监听端口</td><td>80</td></tr>' +
        '</table>' +
        '<h3>7.2 API 接口列表</h3>' +
        '<table><tr><th>方法</th><th>路径</th><th>说明</th></tr>' +
        '<tr><td>GET</td><td><code>/</code></td><td>健康检查</td></tr>' +
        '<tr><td>POST</td><td><code>/api/submit</code></td><td>提交测评（计分+存历史）</td></tr>' +
        '<tr><td>GET</td><td><code>/api/history?page=1&pageSize=20</code></td><td>查询历史</td></tr>' +
        '<tr><td>DELETE</td><td><code>/api/history/:id</code></td><td>删除单条历史</td></tr>' +
        '<tr><td>POST</td><td><code>/api/ai-diagnose</code></td><td>AI 诊断</td></tr>' +
        '</table>' +
        '<h3>7.3 部署/更新</h3>' +
        '<ol><li>修改 <code>cloudbase-run/index.js</code></li>' +
        '<li>重新打包 zip</li>' +
        '<li>云托管 → 服务 → 重新部署</li>' +
        '<li>等待构建完成（约 1-2 分钟）</li></ol>'
    },

    {
      id: 'static',
      title: '8. 静态网站托管',
      icon: '📦',
      html:
        '<h2>静态网站托管（H5 页面）</h2>' +
        '<h3>8.1 页面入口</h3>' +
        '<table><tr><th>页面</th><th>URL</th></tr>' +
        '<tr><td>前端首页</td><td><code>https://rich.soarto.com.cn/index.html</code></td></tr>' +
        '<tr><td>管理后台</td><td><code>https://rich.soarto.com.cn/admin-legacy.html</code></td></tr>' +
        '<tr><td>域名校验</td><td><code>https://rich.soarto.com.cn/fQJW4aYeSL.txt</code></td></tr>' +
        '</table>' +
        '<h3>8.2 文件清单</h3>' +
        '<table><tr><th>文件</th><th>用途</th></tr>' +
        '<tr><td><code>index.html</code></td><td>前端用户页面</td></tr>' +
        '<tr><td><code>admin-legacy.html</code></td><td>后台管理页面</td></tr>' +
        '<tr><td><code>shared-data.js</code></td><td>共享数据（内置量表 + AI 配置）</td></tr>' +
        '<tr><td><code>scoring-engine.js</code></td><td>计分引擎</td></tr>' +
        '<tr><td><code>cloud-data.js</code></td><td>云端数据适配层</td></tr>' +
        '<tr><td><code>cloud-api.js</code></td><td>HTTP API 通信模块</td></tr>' +
        '<tr><td><code>asset-storage.js</code></td><td>资源存储（IndexedDB）</td></tr>' +
        '<tr><td><code>data-monitor.js</code></td><td>数据监控</td></tr>' +
        '<tr><td><code>counselor.png</code></td><td>咨询师立绘</td></tr>' +
        '<tr><td><code>fQJW4aYeSL.txt</code></td><td>域名校验文件（不可删）</td></tr>' +
        '<tr><td><code>manifest.json</code></td><td>构建清单</td></tr>' +
        '</table>' +
        '<blockquote><p>所有文件都有用，没有可删除的冗余文件。</p></blockquote>'
    },

    {
      id: 'build',
      title: '9. 构建部署流程',
      icon: '🔨',
      html:
        '<h2>构建部署流程</h2>' +
        '<h3>9.1 前置配置文件</h3>' +
        '<p>所有配置文件位于项目根目录（与 build-deploy.py 同级）：</p>' +
        '<table><tr><th>文件</th><th>用途</th><th>必需？</th></tr>' +
        '<tr><td><code>scales-data.json</code></td><td>量表数据（后台导出）</td><td>✅ 必需</td></tr>' +
        '<tr><td><code>ai-config.json</code></td><td>AI 接口配置</td><td>✅ 必需</td></tr>' +
        '<tr><td><code>scale-types.json</code></td><td>量表分类配置</td><td>可选</td></tr>' +
        '</table>' +
        '<h3>9.2 ai-config.json 格式</h3>' +
        '<pre>{\n  "provider": "dashscope",\n  "dashscope": {\n    "apiKey": "sk-你的API密钥",\n    "model": "qwen-plus"\n  },\n  "ollama": {\n    "baseUrl": "http://localhost:11434",\n    "model": "qwen2.5:7b"\n  }\n}</pre>' +
        '<blockquote><p>注意：AI 配置有两处 —— ai-config.json（构建注入）和云数据库 config.ai_config（云托管读取），API Key 可能不同。</p></blockquote>' +
        '<h3>9.3 构建命令</h3>' +
        '<pre>cd /Users/rich/WorkBuddy/20260407113106\npython3 build-deploy.py</pre>' +
        '<h3>9.4 构建输出</h3>' +
        '<p>输出目录：<code>deploy/</code></p>' +
        '<p>构建脚本自动完成：</p>' +
        '<ol><li>读取 scales-data.json 中的量表数据</li>' +
        '<li>读取 ai-config.json 中的 AI 配置</li>' +
        '<li>将量表数据注入 shared-data.js 的 DEFAULT_SCALES</li>' +
        '<li>将 AI 配置注入 shared-data.js 的 DEFAULT_AI_CONFIG</li>' +
        '<li>将量表类型注入 admin-legacy.html 的 BUNDLED_SCALE_TYPES</li>' +
        '<li>修改 HTML 中的 JS/CSS 引用路径</li>' +
        '<li>替换 localhost URL 为部署路径</li>' +
        '<li>生成 manifest.json 构建清单</li>' +
        '<li>保留 fQJW4aYeSL.txt 域名校验文件</li></ol>' +
        '<h3>9.5 完整部署流程</h3>' +
        '<pre>修改代码 → 后台导出量表数据 → 保存为 scales-data.json\n        → 编辑 ai-config.json（如有变更）\n        → python3 build-deploy.py\n        → 云开发控制台 → 静态网站托管 → 上传 deploy/ 文件\n        → 验证线上访问</pre>' +
        '<h3>9.6 本地开发预览</h3>' +
        '<pre>cd /Users/rich/WorkBuddy/20260407113106\npython3 -m http.server 8080 --directory .\n# 访问 http://localhost:8080/mini-app-h5/frontend/index.html</pre>'
    },

    {
      id: 'server',
      title: '10. 独立 Web 端',
      icon: '🖥️',
      html:
        '<h2>独立 Web 端部署（www.soarto.com.cn）</h2>' +
        '<h3>10.1 服务器信息</h3>' +
        '<table><tr><th>项目</th><th>值</th></tr>' +
        '<tr><td>公网 IP</td><td><code>101.43.43.125</code></td></tr>' +
        '<tr><td>操作系统</td><td>OpenCloudOS</td></tr>' +
        '<tr><td>宝塔面板</td><td><code>http://101.43.43.125:8888/tencentcloud</code></td></tr>' +
        '<tr><td>网站根目录</td><td><code>/www/wwwroot/www.soarto.com.cn</code></td></tr>' +
        '<tr><td>运行环境</td><td>Nginx 1.28 + MySQL 5.7</td></tr>' +
        '</table>' +
        '<h3>10.2 上传文件到服务器</h3>' +
        '<ol><li>登录宝塔面板</li>' +
        '<li>文件 → 进入 /www/wwwroot/www.soarto.com.cn</li>' +
        '<li>上传 deploy/ 目录下所有文件</li></ol>' +
        '<h3>10.3 SSL 证书（备案通过后操作）</h3>' +
        '<blockquote><p>前置条件：ICP 接入备案必须审核通过后才能申请 SSL。</p></blockquote>' +
        '<ol><li>宝塔面板 → 网站 → www.soarto.com.cn → SSL</li>' +
        "<li>选择 Let's Encrypt → 申请</li>" +
        '<li>开启强制 HTTPS</li></ol>' +
        '<h3>10.4 备案状态</h3>' +
        '<table><tr><th>项目</th><th>状态</th></tr>' +
        '<tr><td>域名备案</td><td>阿里云已完成</td></tr>' +
        '<tr><td>接入备案</td><td>腾讯云审核中</td></tr>' +
        '<tr><td>预计时间</td><td>7-20 个工作日</td></tr>' +
        '</table>'
    },

    {
      id: 'ai',
      title: '11. AI 接口配置',
      icon: '🤖',
      html:
        '<h2>AI 接口配置</h2>' +
        '<h3>11.1 架构说明</h3>' +
        '<p>AI 功能有两个调用路径：</p>' +
        '<pre>路径 1（前端直连）：H5 → shared-data.js 读取 Key → 直连 DashScope\n路径 2（代理调用）：H5 → 云托管 API → 云数据库读配置 → 调用 DashScope</pre>' +
        '<ul><li><strong>WebView 模式</strong>（小程序内）：主要走路径 2，更安全</li>' +
        '<li><strong>独立 Web 端</strong>（浏览器）：走路径 1，需要 ai-config.json 有有效 Key</li></ul>' +
        '<h3>11.2 API Key 管理</h3>' +
        '<table><tr><th>位置</th><th>配置方式</th><th>说明</th></tr>' +
        '<tr><td><code>ai-config.json</code></td><td>手动编辑</td><td>构建时注入到 H5 前端</td></tr>' +
        '<tr><td><code>shared-data.js</code></td><td>build-deploy.py 注入</td><td>线上运行的配置</td></tr>' +
        '<tr><td>云数据库 config.ai_config</td><td>后台或控制台</td><td>云托管 API 读取</td></tr>' +
        '<tr><td>DashScope 控制台</td><td><a href="https://dashscope.console.aliyun.com" target="_blank">在线管理</a></td><td>管理 Key / 查看用量</td></tr>' +
        '</table>' +
        '<h3>11.3 当前模型</h3>' +
        '<table><tr><th>项目</th><th>值</th></tr>' +
        '<tr><td>提供商</td><td>阿里云 DashScope</td></tr>' +
        '<tr><td>模型</td><td>qwen-plus</td></tr>' +
        '<tr><td>API 端点</td><td><code>https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions</code></td></tr>' +
        '</table>'
    },

    {
      id: 'checklist',
      title: '12. 运维检查清单',
      icon: '✅',
      html:
        '<h2>日常运维检查清单</h2>' +
        '<h3>12.1 每月检查</h3>' +
        '<ul><li>☐ 云开发套餐是否即将到期（控制台 → 套餐管理）</li>' +
        '<li>☐ SSL 证书是否即将到期（查看第 4 节清单）</li>' +
        '<li>☐ 域名是否即将到期（阿里云域名管理）</li>' +
        '<li>☐ 服务器是否正常运行（宝塔面板检查）</li>' +
        '<li>☐ DashScope API 用量和余额</li></ul>' +
        '<h3>12.2 每次部署后</h3>' +
        '<ul><li>☐ 构建成功（python3 build-deploy.py 无报错）</li>' +
        '<li>☐ deploy/ 文件已上传到云开发静态网站托管</li>' +
        '<li>☐ 域名校验文件 fQJW4aYeSL.txt 存在</li>' +
        '<li>☐ 线上访问正常（https://rich.soarto.com.cn/index.html）</li>' +
        '<li>☐ 小程序 WebView 能正常加载 H5</li>' +
        '<li>☐ 测评流程走通（选量表 → 答题 → 查看结果）</li>' +
        '<li>☐ AI 诊断功能正常</li>' +
        '<li>☐ 历史记录保存和读取正常</li></ul>' +
        '<h3>12.3 版本发布</h3>' +
        '<ol><li>修改代码</li>' +
        '<li>更新 app.js 中的 version 版本号</li>' +
        '<li>更新 webview.js 中的 v= URL 参数版本号</li>' +
        '<li>从后台导出最新量表数据为 scales-data.json</li>' +
        '<li>运行 python3 build-deploy.py</li>' +
        '<li>上传 deploy/ 到静态网站托管</li>' +
        '<li>微信开发者工具 → 上传代码</li>' +
        '<li>提交审核 → 审核通过 → 发布</li></ol>'
    },

    {
      id: 'faq',
      title: '13. 常见问题排查',
      icon: '❓',
      html:
        '<h2>常见问题排查</h2>' +
        '<h3>Q1：小程序 WebView 加载空白</h3>' +
        '<ul><li>检查网络：rich.soarto.com.cn 能否在浏览器访问</li>' +
        '<li>检查域名：公众平台 → 业务域名，确认 rich.soarto.com.cn 在列表中</li>' +
        '<li>检查校验文件：rich.soarto.com.cn/fQJW4aYeSL.txt 返回校验值</li>' +
        '<li>微信认证是否已通过</li></ul>' +
        '<h3>Q2：测评提交后无结果</h3>' +
        '<ul><li>检查 scoring-engine.js 是否加载成功（控制台搜索 "scoring-engine.js"）</li>' +
        '<li>检查量表是否有计分规则（后台 → 量表管理 → 计分规则）</li>' +
        '<li>检查 shared-data.js 是否加载成功</li></ul>' +
        '<h3>Q3：AI 诊断报错</h3>' +
        '<ul><li>检查 API Key 是否有效（DashScope 控制台）</li>' +
        '<li>WebView 模式检查云托管 API 服务是否运行</li>' +
        '<li>检查云数据库 config.ai_config 文档是否存在</li></ul>' +
        '<h3>Q4：历史记录丢失</h3>' +
        '<ul><li>无 openid 时仅保存在本地 localStorage</li>' +
        '<li>清除浏览器缓存会丢失本地数据</li>' +
        '<li>云端数据需要通过 API 获取（需要 openid）</li></ul>' +
        '<h3>Q5：构建脚本报错 "未找到占位符"</h3>' +
        '<p>说明 shared-data.js 中的占位符已被上次构建替换为实际数据。已修复：构建脚本会自动检测内置数据并跳过注入。</p>' +
        '<h3>Q6：HTTPS 证书过期</h3>' +
        '<ul><li>rich.soarto.com.cn：微信云开发自动续期</li>' +
        '<li>identity.soarto.com.cn：阿里云手动续签（到期前 30 天）</li>' +
        "<li>www.soarto.com.cn：宝塔 Let's Encrypt 自动续期（需先完成备案）</li></ul>"
    },

    {
      id: 'links',
      title: '附录：链接速查',
      icon: '🔗',
      html:
        '<h2>附录 A：关键链接速查</h2>' +
        '<table><tr><th>名称</th><th>URL</th></tr>' +
        '<tr><td>微信公众平台</td><td><a href="https://mp.weixin.qq.com" target="_blank">mp.weixin.qq.com</a></td></tr>' +
        '<tr><td>微信开发者工具</td><td><a href="https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html" target="_blank">下载地址</a></td></tr>' +
        '<tr><td>微信云开发控制台</td><td>公众平台 → 开发管理 → 云开发</td></tr>' +
        '<tr><td>腾讯云轻量服务器</td><td><a href="https://console.cloud.tencent.com/lighthouse" target="_blank">控制台</a></td></tr>' +
        '<tr><td>阿里云域名管理</td><td><a href="https://dc.console.aliyun.com" target="_blank">控制台</a></td></tr>' +
        '<tr><td>DashScope 控制台</td><td><a href="https://dashscope.console.aliyun.com" target="_blank">控制台</a></td></tr>' +
        '<tr><td>宝塔面板</td><td><code>http://101.43.43.125:8888/tencentcloud</code></td></tr>' +
        '<tr><td>H5 前端</td><td><a href="https://rich.soarto.com.cn/index.html" target="_blank">rich.soarto.com.cn</a></td></tr>' +
        '<tr><td>H5 后台</td><td><a href="https://rich.soarto.com.cn/admin-legacy.html" target="_blank">rich.soarto.com.cn/admin</a></td></tr>' +
        '<tr><td>API 健康检查</td><td><a href="https://identity.soarto.com.cn" target="_blank">identity.soarto.com.cn</a></td></tr>' +
        '</table>' +
        '<h2>附录 B：项目文件结构</h2>' +
        '<pre>项目根目录/\n├── build-deploy.py          # 构建部署脚本\n├── scales-data.json         # 量表数据（后台导出）\n├── ai-config.json           # AI 接口配置\n├── scale-types.json         # 量表类型配置\n├── deploy/                  # 构建输出目录\n│   ├── index.html           # 前端页面\n│   ├── admin-legacy.html    # 后台管理\n│   ├── shared-data.js       # 共享数据模块\n│   ├── scoring-engine.js    # 计分引擎\n│   ├── cloud-data.js        # 云端数据适配\n│   ├── cloud-api.js         # API 通信模块\n│   ├── asset-storage.js     # 资源存储\n│   ├── data-monitor.js      # 数据监控\n│   ├── counselor.png        # 咨询师立绘\n│   ├── fQJW4aYeSL.txt       # 域名校验文件\n│   └── manifest.json        # 构建清单\n├── mini-app-h5/             # H5 源码\n├── cloudbase-run/           # 云托管 API 服务源码\n└── wechat-miniprogram/      # 微信小程序源码</pre>'
    }
  ];

  // ====================================================
  // 导出
  // ====================================================

  // 挂载到全局
  global.OPS_MANUAL_SECTIONS = OPS_MANUAL_SECTIONS;
})(window);
