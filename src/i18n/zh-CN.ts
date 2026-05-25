// Claude 网页端英文 → 简体中文 字典。
//
// 维护准则：
//  - key 必须是 Claude 页面上原文的「精确文本」（首字母大小写要一致）。
//  - 含尾随冒号、问号等标点的字符串建议单独列一条，避免漏匹配。
//  - 短词（如 "OK"）放在 EXACT_WORDS 中只匹配独立文本节点，避免误伤句中单词。
//  - 半动态文本（如 "Afternoon, Bee"）用 PATTERN_REPLACEMENTS 的正则。
//  - aria-label / placeholder / title / alt 的英文也都从这里查询。

export const TEXT_DICT: Readonly<Record<string, string>> = {
  // 主侧边栏 & 导航
  'Home': '主页', // 导航语境固定译「主页」，盖掉 MT 误翻的「家」
  'New chat': '新建对话',
  'Start new chat': '新建对话',
  'Chats': '对话',
  'Chat': '对话',
  'Recents': '最近',
  'Recent': '最近',
  'Projects': '项目',
  'Starred': '已收藏',
  'Favorites': '收藏',
  'Artifacts': '工件',
  'Sidebar': '侧边栏',
  'Open sidebar': '展开侧边栏',
  'Close sidebar': '收起侧边栏',
  'Search': '搜索',
  'Search chats': '搜索对话',
  'Customize': '个性化',
  'Design': '设计',
  'More': '更多',
  'Pro plan': 'Pro 套餐',
  'Free plan': '免费套餐',
  'Team plan': '团队套餐',
  'Enterprise plan': '企业套餐',

  // 顶栏 & 账号
  'Settings': '设置',
  'Profile': '个人资料',
  'Account': '账号',
  'Log out': '退出登录',
  'Sign out': '退出登录',
  'Sign in': '登录',
  'Upgrade plan': '升级套餐',
  'Upgrade': '升级',
  'Help & support': '帮助与支持',
  'Help': '帮助',
  'Feedback': '反馈',
  'Give feedback': '提交反馈',
  'What’s new': '更新日志',
  "What's new": '更新日志',
  'Keyboard shortcuts': '键盘快捷键',
  'Get app': '下载应用',
  'Download app': '下载应用',
  'Get apps and extensions': '获取应用和扩展',
  'Get help': '获取帮助',
  'Help center': '帮助中心',
  'View all plans': '查看所有套餐',
  'Gift Claude': '赠送 Claude',
  'Refer a friend': '推荐给好友',
  'Learn more': '了解更多',

  // 模型选择
  'Choose model': '选择模型',
  'Choose style': '选择风格',
  'Choose response style': '选择回复风格',
  'Default': '默认',
  'Most capable model': '最强模型',
  'Most capable for ambitious work': '最强模型，适合复杂工作',
  'Fastest model': '最快模型',
  'Concise': '简洁',
  'Normal': '标准',
  'Explanatory': '详细',
  'Formal': '正式',
  'More models': '更多模型',
  'Adaptive thinking': '自适应思考',
  'Adaptive': '自适应',
  'Extended': '扩展',
  'Extended thinking': '扩展思考',
  'Thinks for more complex tasks': '面对更复杂的任务时会深入思考',
  'Style': '风格',
  'Tools': '工具',
  'Capabilities': '能力',

  // 输入框
  'Send a message...': '发送消息...',
  'Write a message...': '输入消息...',
  'Write a message': '输入消息',
  'Reply to Claude...': '回复 Claude...',
  'Message Claude...': '向 Claude 发送消息...',
  'How can I help you today?': '今天我能帮你做什么？',
  'How can I help?': '我能帮你做什么？',
  'Attach files': '附加文件',
  'Attach': '附加',
  'Add from Google Drive': '从 Google Drive 添加',
  'Upload a file': '上传文件',
  'Add content': '添加内容',
  'Voice input': '语音输入',
  'Drop files to attach': '拖入文件以添加',

  // 操作按钮
  'Send': '发送',
  'Send message': '发送消息',
  'Stop': '停止',
  'Stop generating': '停止生成',
  'Stop response': '停止回复',
  'Regenerate': '重新生成',
  'Continue': '继续',
  'Continue generating': '继续生成',
  'Retry': '重试',
  'Try again': '重试',
  'Cancel': '取消',
  'Save': '保存',
  'Save changes': '保存修改',
  'Confirm': '确认',
  'Submit': '提交',
  'Done': '完成',
  'Close': '关闭',
  'Back': '返回',
  'Next': '下一步',
  'Previous': '上一步',
  'Skip': '跳过',
  'Reset': '重置',

  // 欢迎页快捷操作（welcome screen 上的按钮）
  'Write': '写作',
  'Learn': '学习',
  'Code': '编程',
  'Life stuff': '生活',
  "Claude's choice": 'Claude 推荐',
  'Brainstorm': '头脑风暴',
  'Get advice': '寻求建议',
  'Make a plan': '制定计划',
  'Analyze data': '数据分析',
  'Help me write': '帮我写作',
  'Summarize text': '总结文本',
  'Explain a concept': '解释概念',

  // 消息上的操作
  'Copy': '复制',
  'Copy message': '复制消息',
  'Copy code': '复制代码',
  'Copy link': '复制链接',
  'Copied!': '已复制！',
  'Copied': '已复制',
  'Edit': '编辑',
  'Edit message': '编辑消息',
  'Delete': '删除',
  'Delete message': '删除消息',
  'Good response': '回答不错',
  'Bad response': '回答不佳',
  'Like': '赞',
  'Dislike': '踩',
  'Share': '分享',
  'Share chat': '分享对话',
  'Rename': '重命名',
  'Archive': '归档',
  'Unarchive': '取消归档',
  'Star': '收藏',
  'Unstar': '取消收藏',
  'Pin': '置顶',
  'Unpin': '取消置顶',
  'Delete chat': '删除对话',
  'Delete conversation': '删除对话',
  'Rename chat': '重命名对话',
  'Export': '导出',
  'Export chat': '导出对话',
  'Move': '移动',
  'Move to project': '移动到项目',
  'Read aloud': '朗读',
  'Speak': '朗读',

  // 项目相关
  'New project': '新建项目',
  'Create project': '创建项目',
  'Project knowledge': '项目知识',
  'Add to project': '加入项目',
  'Remove from project': '移出项目',
  'Set custom instructions': '设置自定义指令',
  'Custom instructions': '自定义指令',
  'Instructions': '指令',
  'Description': '描述',
  'Project name': '项目名称',
  'Add files': '添加文件',
  'Project files': '项目文件',
  'View all': '查看全部',
  'See all': '查看全部',

  // 弹窗与确认
  'Are you sure?': '确定吗？',
  'This action cannot be undone.': '此操作无法撤销。',
  'This will permanently delete the chat.': '这将永久删除此对话。',
  'Yes, delete': '确认删除',
  'No, keep it': '保留',
  'OK': '好的',
  'Got it': '知道了',
  'Dismiss': '关闭',

  // 占位与状态
  'Thinking...': '正在思考...',
  'Generating...': '正在生成...',
  'Loading...': '加载中...',
  'Searching...': '正在搜索...',
  'No results': '没有结果',
  'No results found': '未找到结果',
  'No chats yet': '还没有对话',
  'No projects yet': '还没有项目',
  'No starred chats': '没有已收藏的对话',
  'Untitled': '未命名',
  'New conversation': '新建对话',

  // 文件 & 工件
  'Preview': '预览',
  'Download': '下载',
  'Open in new tab': '在新标签页打开',
  'Refresh': '刷新',
  'Expand': '展开',
  'Collapse': '收起',
  'Fullscreen': '全屏',
  'Exit fullscreen': '退出全屏',
  'Run': '运行',
  'View source': '查看源码',
  'View output': '查看输出',
  'Copy output': '复制输出',

  // 免责声明 / footer 文本
  'Claude is AI and can make mistakes. Please double-check responses.':
    'Claude 是 AI，可能会出错。请核实回复内容。',
  'Claude can make mistakes. Please double-check responses.':
    'Claude 可能会出错，请核实回复内容。',
  'AI responses may include mistakes.': 'AI 的回复可能存在错误。',
  'Terms': '条款',
  'Privacy': '隐私',
  'Acceptable Use Policy': '可接受使用政策',
  'Privacy Policy': '隐私政策',
  'Terms of Service': '服务条款',

  // 时间相关（greeting 用 PATTERN_REPLACEMENTS）
  'Today': '今天',
  'Yesterday': '昨天',
  'This week': '本周',
  'Last week': '上周',
  'This month': '本月',
  'Last month': '上月',

  // 设置页 —— 左侧分类（Account/Privacy/Capabilities 已在前文定义，此处不重复）
  'General': '通用',
  'Billing': '账单',
  'Usage': '用量',
  'Connectors': '连接器',
  'Connections': '连接',
  'Integrations': '集成',
  'Claude Code': 'Claude Code',
  'Claude in Chrome': 'Chrome 中的 Claude',
  'Beta': '测试版',
  'New': '新',

  // 设置页 —— Profile 区（Profile 已在前文定义）
  'Personal info': '个人信息',
  'Avatar': '头像',
  'Full name': '全名',
  'Display name': '显示名',
  'What should Claude call you?': '你希望 Claude 怎么称呼你？',
  'What best describes your work?': '你的工作是什么？',
  'Select': '请选择',
  'None selected': '未选择',
  'Instructions for Claude': '给 Claude 的指令',
  'Claude will keep these in mind across chats and Cowork within Anthropic’s guidelines.':
    'Claude 会在所有对话中遵循这些指令，并保持在 Anthropic 准则范围内。',
  "Claude will keep these in mind across chats and Cowork within Anthropic's guidelines.":
    'Claude 会在所有对话中遵循这些指令，并保持在 Anthropic 准则范围内。',
  "Anthropic's guidelines": 'Anthropic 准则',
  'e.g. when learning new concepts, I find analogies particularly helpful':
    '比如：学习新概念时，我觉得类比特别有帮助',
  'Add instructions': '添加指令',
  'Edit instructions': '编辑指令',

  // 设置页 —— Preferences
  'Preferences': '偏好',
  'Appearance': '外观',
  'Theme': '主题',
  'System': '跟随系统',
  'Light': '浅色',
  'Dark': '深色',
  'Chat font': '对话字体',
  'Anthropic Serif': 'Anthropic Serif',
  'System font': '系统字体',
  'Default font': '默认字体',
  'Language': '语言',
  'Voice': '语音',
  'Voice speed': '语速',
  'Standard': '标准',
  'Slow': '慢',
  'Fast': '快',
  'Slower': '较慢',
  'Faster': '较快',
  'Buttery': 'Buttery',

  // 设置页 —— Notifications
  'Notifications': '通知',
  'Response completions': '回复完成',
  'Get notified when Claude has finished a response. Useful for long-running tasks.':
    'Claude 完成回复时通知你。适合耗时较长的任务。',
  'Code notifications': '代码通知',
  'Claude can choose to notify you about important updates from a Code session.':
    'Claude 会主动通知你 Code 会话中的重要更新。',
  'Enable notifications': '启用通知',
  'Browser notifications': '浏览器通知',
  'Email notifications': '邮件通知',
  'Push notifications': '推送通知',
  'Sound': '声音',
  'Vibration': '震动',

  // 设置页 —— Account
  'Email address': '邮箱地址',
  'Email': '邮箱',
  'Phone number': '手机号',
  'Password': '密码',
  'Change password': '修改密码',
  'Two-factor authentication': '双因素认证',
  'Connected apps': '已连接应用',
  'Active sessions': '活跃会话',
  'Delete account': '删除账号',
  'Export data': '导出数据',
  'Manage data': '管理数据',

  // 设置页 —— Privacy
  'Allow training': '允许训练',
  'Allow your chats to be used to improve our models': '允许使用你的对话来改进模型',
  'Data retention': '数据保留',
  'Conversation history': '对话历史',
  'Clear all chats': '清除所有对话',
  'Auto-delete chats': '自动删除对话',
  'Privacy settings': '隐私设置',
  'Cookie preferences': 'Cookie 偏好',
  'Manage privacy': '管理隐私',

  // 设置页 —— Billing / Usage
  'Manage subscription': '管理订阅',
  'Subscription': '订阅',
  'Plan': '套餐',
  'Current plan': '当前套餐',
  'Renews': '续费',
  'Renews on': '续费日',
  'Cancel subscription': '取消订阅',
  'Resume subscription': '恢复订阅',
  'Payment method': '支付方式',
  'Add payment method': '添加支付方式',
  'Billing history': '账单历史',
  'Invoices': '发票',
  'View invoice': '查看发票',
  'Tokens used': '已用 Token',
  'Tokens remaining': '剩余 Token',
  'Messages used': '已用消息',
  'Messages remaining': '剩余消息',
  'Reset on': '重置日期',
  'Usage limit': '用量上限',

  // 设置页 —— Capabilities / Connectors
  'Web search': '网页搜索',
  'Code execution': '代码执行',
  'File analysis': '文件分析',
  'Image generation': '图像生成',
  'Connect': '连接',
  'Disconnect': '断开连接',
  'Connected': '已连接',
  'Not connected': '未连接',
  'Manage connectors': '管理连接器',
  'Add connector': '添加连接器',

  // 设置页 —— Claude in Chrome / Code
  'Install Claude in Chrome': '安装 Chrome 中的 Claude',
  'Install': '安装',
  'Open in Chrome': '在 Chrome 中打开',
  'Claude in your browser': '在浏览器中使用 Claude',
  'Browser extension': '浏览器扩展',
  'Coming soon': '即将推出',
  'Join the waitlist': '加入等候名单',
  'Join waitlist': '加入等候名单',
  'Get early access': '获取抢先体验',
  'Learn more about Claude Code': '了解 Claude Code',

  // 设置页 —— 通用按钮
  'Edit profile': '编辑个人资料',
  'Update': '更新',
  'Apply': '应用',
  'Discard': '放弃',
  'Discard changes': '放弃修改',
  'Saved': '已保存',
  'Saving...': '正在保存...',
  'Unsaved changes': '有未保存的修改',
  'View': '查看',
  'Manage': '管理',
  'Configure': '配置',
  'Enable': '启用',
  'Disable': '停用',
  'Enabled': '已启用',
  'Disabled': '已停用',

  // 工件 / Artifact
  'Open artifact': '打开工件',
  'Close artifact': '关闭工件',

  // ========= 设置页截图补充（General / Account / Privacy / Billing / Usage）=========
  // General —— 通知
  'Code permission requests': '代码权限请求',
  'Get a push notification when Claude needs your approval to run a command in a Code session.':
    '当 Claude 需要你批准在 Code 会话中运行命令时，推送通知给你。',
  'Emails from Claude Code on the web': '来自网页版 Claude Code 的邮件',
  'Get an email when Claude Code on the web has finished building or needs your response.':
    '当网页版 Claude Code 构建完成或需要你回复时，发邮件通知你。',
  'Dispatch messages': 'Dispatch 消息',
  'Get a push notification on your phone when Claude messages you in Dispatch.':
    '当 Claude 在 Dispatch 中给你发消息时，推送通知到你手机。',
  'e.g. ask clarifying questions before giving detailed answers':
    '比如：给出详细回答前先反问澄清',

  // Account
  'Log out of all devices': '退出所有设备的登录',
  'To delete your account, please cancel your Claude Pro subscription first.':
    '要删除账号，请先取消你的 Claude Pro 订阅。',
  'Organization ID': '组织 ID',
  'Device': '设备',
  'Location': '位置',
  'Created': '创建时间',
  'Updated': '更新时间',

  // Privacy
  'Anthropic believes in transparent data practices. Learn how your information is protected when using Anthropic products, and visit our':
    'Anthropic 坚持透明的数据实践。了解使用 Anthropic 产品时你的信息如何受保护，并访问我们的',
  'for more details.': '以了解更多详情。',
  'Privacy Center': '隐私中心',
  'How we protect your data': '我们如何保护你的数据',
  'How we use your data': '我们如何使用你的数据',
  'Location metadata': '位置元数据',
  'Allow Claude to use coarse location metadata (city/region) to improve product experiences.':
    '允许 Claude 使用粗略位置信息（城市/地区）来改进产品体验。',
  'Help improve Claude': '帮助改进 Claude',
  'Allow the use of your chats and coding sessions to train and improve Anthropic AI models.':
    '允许使用你的对话和编程会话来训练并改进 Anthropic 的 AI 模型。',
  'Your data': '你的数据',
  'Shared chats': '已分享的对话',
  'Memory preferences': '记忆偏好',

  // Billing
  'Annual': '按年',
  'Monthly': '按月',
  'Adjust plan': '调整套餐',
  'Subscribed via iOS app': '通过 iOS 应用订阅',
  'Manage subscription and view invoices on your iOS device':
    '在你的 iOS 设备上管理订阅、查看发票',

  // Usage
  'Plan usage limits': '套餐用量上限',
  'Current session': '当前会话',
  'Weekly limits': '每周上限',
  'Learn more about usage limits': '了解用量上限详情',
  'All models': '所有模型',
  'Claude Design': 'Claude Design',
  "You haven't used Claude Design yet": '你还没用过 Claude Design',
  'Additional features': '附加功能',
  'Daily included routine runs': '每日包含的例程运行次数',
  "You haven't run any routines yet": '你还没运行过任何例程',
  'Usage credits': '用量额度',
  'Turn on usage credits to keep using Claude if you hit a limit.':
    '开启用量额度，达到上限后仍可继续使用 Claude。',
  'Monthly spend limit': '每月消费上限',
  'Adjust limit': '调整上限',
  'Current balance': '当前余额',
  'Auto-reload': '自动充值',
  'Buy usage credits': '购买用量额度',
  'Up to 30% off': '最高 7 折',
  'Last updated: just now': '最后更新：刚刚',

  // ========= 设置页截图补充 2（Capabilities / Connectors / Claude Code / Claude in Chrome）=========
  // Capabilities —— Memory
  'Memory': '记忆',
  'Search and reference chats': '搜索并引用历史对话',
  'Allow Claude to search for relevant details in past chats.':
    '允许 Claude 在过往对话中搜索相关细节。',
  'Generate memory from chat history': '从对话历史生成记忆',
  'Allow Claude to remember relevant context from your chats. This setting controls memory for both chats and projects.':
    '允许 Claude 记住你对话中的相关上下文。此设置同时控制对话和项目的记忆。',
  'Import memory from other AI providers': '从其他 AI 服务导入记忆',
  "Bring relevant context and data from another AI provider to Claude. We'll provide a prompt you can use to fetch the memory from your other account.":
    '把其他 AI 服务的相关上下文和数据带到 Claude。我们会提供一段提示词，供你从另一个账号获取记忆。',
  'Start import': '开始导入',

  // Capabilities —— General（工具 / 连接器）
  'Tool access mode': '工具访问模式',
  'Controls how connector tools are loaded in new conversations.':
    '控制连接器工具在新对话中如何加载。',
  'Load tools when needed': '按需加载工具',
  'Connector discovery': '连接器发现',
  'Let Claude surface connectors from the directory that may be relevant to your conversation.':
    '让 Claude 从目录中推荐可能与你对话相关的连接器。',

  // Capabilities —— Visuals
  'Visuals': '可视化',
  'Generate code, documents, and designs in a dedicated window alongside your conversation.':
    '在对话旁的独立窗口中生成代码、文档和设计。',
  'AI-powered artifacts': 'AI 驱动的工件',
  'Build apps and interactive documents that use Claude inside the artifact.':
    '构建在工件内部调用 Claude 的应用和交互式文档。',
  'Inline visualizations': '内联可视化',
  'Allow Claude to generate interactive visualizations, charts, and diagrams directly in the conversation.':
    '允许 Claude 直接在对话中生成交互式可视化、图表和示意图。',

  // Capabilities —— Code execution
  'Code execution and file creation': '代码执行与文件创建',
  'Claude can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports. Required for skills.':
    'Claude 可以执行代码，并创建和编辑文档、电子表格、演示文稿、PDF 和数据报告。技能功能需要此项。',
  'Allow network egress': '允许网络出站',
  'security risks': '安全风险',
  'Domain allowlist': '域名白名单',
  'Choose which domains the sandbox can access': '选择沙箱可以访问哪些域名',
  'Package managers only': '仅包管理器',
  'Claude can access common package managers plus any additional domains you specify below.':
    'Claude 可以访问常见的包管理器，以及你在下方指定的任何额外域名。',
  'View package manager domains': '查看包管理器域名',
  'Additional allowed domains': '额外允许的域名',
  'Add': '添加',
  'Skills': '技能',
  'Skills have moved to': '技能已移至',

  // Connectors 页
  'Connectors have moved to': '连接器已移至',
  'Head there to browse, connect, and manage them.': '前往那里浏览、连接和管理它们。',

  // Claude Code 页 —— Code appearance
  'Code appearance': '代码外观',
  'Claude Light': 'Claude 浅色',
  'Claude Dark': 'Claude 深色',
  'Code font': '代码字体',
  'Set a custom monospace font for code and terminal.': '为代码和终端设置自定义等宽字体。',

  // Claude Code 页 —— Appearance
  'High-contrast dark theme': '高对比度深色主题',
  'Use a darker, near-black background when dark mode is on.':
    '深色模式下使用更暗、接近纯黑的背景。',
  'Interface font': '界面字体',
  'Font for the Claude Code interface — menus, sidebar, and chat.':
    'Claude Code 界面的字体——菜单、侧边栏和聊天。',
  'Transcript text size': '转录文字大小',
  'Size of the conversation transcript text.': '对话转录文字的大小。',
  'Small': '小',
  'Medium': '中',
  'Large': '大',

  // Claude Code 页 —— General / Pull requests
  'Classify session states': '自动分类会话状态',
  'Allow Claude to automatically classify sessions as blocked, ready for review, or done. Classifying sessions counts towards your plan usage. Applies to new sessions.':
    '允许 Claude 自动把会话分类为「受阻」「待审查」或「已完成」。分类会话会计入你的套餐用量。仅对新会话生效。',
  'Pull requests': 'Pull Request',
  'Create pull requests automatically': '自动创建 Pull Request',
  'When Claude pushes changes to a branch, it automatically opens a pull request without asking first. Applies to remote sessions only.':
    '当 Claude 把改动推送到分支时，会自动创建 Pull Request 而不先询问。仅对远程会话生效。',
  'Autofix pull requests': '自动修复 Pull Request',
  'When you create a pull request, Claude automatically monitors it for CI failures and review comments, then responds proactively. Claude may post comments on your behalf.':
    '当你创建 Pull Request 时，Claude 会自动监控 CI 失败和审查评论并主动响应。Claude 可能会以你的名义发表评论。',

  // Claude Code 页 —— Authorization tokens
  'Authorization tokens': '授权令牌',
  'Created when you sign in to Claude Code. Revoke a token to sign out from that device.':
    '在你登录 Claude Code 时创建。吊销某个令牌即可从该设备登出。',
  'Application': '应用',
  'Scopes': '权限范围',
  'Claude Code (CLI, Desktop, IDE)': 'Claude Code（CLI、桌面端、IDE）',
  'Delete sessions stored by Anthropic': '删除 Anthropic 存储的会话',
  'Sharing settings': '分享设置',
  'Control how your claude.ai/code sessions are shared.':
    '控制你的 claude.ai/code 会话如何被分享。',

  // Claude in Chrome 页
  'Claude in Chrome settings': 'Chrome 中的 Claude 设置',
  'Site permissions': '站点权限',
  'Default for all sites': '所有站点的默认策略',
  'Choose whether Claude in Chrome works on all sites by default':
    '选择 Chrome 中的 Claude 是否默认在所有站点上工作',
  'Select default policy': '选择默认策略',

  // Claude Voyager 自身的 UI
  'Timeline': '时间轴',
  'Progress': '进度',
  'Scroll to message': '滚动到该消息',
  'Star this message': '收藏该消息',
  'Unstar this message': '取消收藏',
};

// 仅在「整段文本节点等于这个词」时替换；用于短到容易撞车的词。
export const EXACT_WORDS: Readonly<Record<string, string>> = {
  'OK': '好的',
  'Done': '完成',
  'Send': '发送',
  'Stop': '停止',
  'Copy': '复制',
  'Edit': '编辑',
  'Delete': '删除',
  'Save': '保存',
  'Cancel': '取消',
  'Retry': '重试',
  'Share': '分享',
  'Star': '收藏',
  'Code': '代码',
  'Preview': '预览',
  'Settings': '设置',
  'Help': '帮助',
  'Chats': '对话',
  'Projects': '项目',
  'Recents': '最近',
  'Search': '搜索',
  'More': '更多',
  'Customize': '个性化',
  'Design': '设计',
  'Write': '写作',
  'Learn': '学习',
  'Back': '返回',
  'Next': '下一步',
  'Close': '关闭',
  'Run': '运行',
  'Submit': '提交',
  'Beta': '测试版',
  'New': '新',
  'View': '查看',
  'Manage': '管理',
  'Update': '更新',
  'Apply': '应用',
  'Standard': '标准',
  'Light': '浅色',
  'Dark': '深色',
  'System': '跟随系统',
  'Connect': '连接',
  'Install': '安装',
  'Enabled': '已启用',
  'Disabled': '已停用',
  'Connected': '已连接',
  'Voice': '语音',
  // 开关状态 / 徽章（仅独立文本节点才替换，安全）
  'On': '开',
  'Off': '关',
  'Current': '当前',
  'Annual': '按年',
  'Monthly': '按月',
  'Device': '设备',
  'Location': '位置',
  'Created': '创建时间',
  'Updated': '更新时间',
};

/**
 * 半动态文本：用正则匹配，能取出 capture group。
 * `replace` 支持 `$1`、`$2` 等反向引用。
 * 这里只放确实需要正则的条目，能用纯字符串字典就别用正则。
 */
export const PATTERN_REPLACEMENTS: ReadonlyArray<{ match: RegExp; replace: string }> = [
  // 欢迎语 "Good morning/afternoon/evening, X" 或 "Morning/Afternoon/Evening, X"
  { match: /^Good morning, (.+)$/, replace: '早上好，$1' },
  { match: /^Good afternoon, (.+)$/, replace: '下午好，$1' },
  { match: /^Good evening, (.+)$/, replace: '晚上好，$1' },
  { match: /^Good night, (.+)$/, replace: '晚安，$1' },
  { match: /^Morning, (.+)$/, replace: '早上好，$1' },
  { match: /^Afternoon, (.+)$/, replace: '下午好，$1' },
  { match: /^Evening, (.+)$/, replace: '晚上好，$1' },
  { match: /^Welcome back, (.+)$/, replace: '欢迎回来，$1' },
  { match: /^Happy (.+), (.+)$/, replace: '$1快乐，$2' },

  // 计数：N chats / N messages / N projects
  { match: /^(\d+) chats?$/, replace: '$1 条对话' },
  { match: /^(\d+) messages?$/, replace: '$1 条消息' },
  { match: /^(\d+) projects?$/, replace: '$1 个项目' },
  { match: /^(\d+) files?$/, replace: '$1 个文件' },
  { match: /^(\d+) tokens?$/, replace: '$1 个 token' },
  { match: /^(\d+) results?$/, replace: '$1 个结果' },

  // 时间相对量
  { match: /^(\d+) minutes? ago$/, replace: '$1 分钟前' },
  { match: /^(\d+) hours? ago$/, replace: '$1 小时前' },
  { match: /^(\d+) days? ago$/, replace: '$1 天前' },
  { match: /^Just now$/, replace: '刚刚' },
  { match: /^A moment ago$/, replace: '刚刚' },

  // 用量页 —— 百分比 / 重置时间 / 配额
  { match: /^(\d+)% used$/, replace: '已用 $1%' },
  { match: /^(\d+(?:\.\d+)?)% of limit$/, replace: '占上限 $1%' },
  { match: /^Resets in (.+)$/, replace: '$1后重置' },
  { match: /^Resets (.+)$/, replace: '$1 重置' },
  { match: /^Last updated: (.+)$/, replace: '最后更新：$1' },
  { match: /^\$(\d+(?:\.\d+)?) spent$/, replace: '已花费 \$$1' },
  { match: /^Up to (\d+)% off$/, replace: '最高省 $1%' },

  // 授权令牌 / 会话「Connected X ago」
  { match: /^Connected (\d+) minutes? ago$/, replace: '$1 分钟前连接' },
  { match: /^Connected (\d+) hours? ago$/, replace: '$1 小时前连接' },
  { match: /^Connected (\d+) days? ago$/, replace: '$1 天前连接' },
  { match: /^Connected (\d+) weeks? ago$/, replace: '$1 周前连接' },
  { match: /^Connected (\d+) months? ago$/, replace: '$1 个月前连接' },
  { match: /^Connected a day ago$/, replace: '1 天前连接' },
  { match: /^Connected yesterday$/, replace: '昨天连接' },
];
