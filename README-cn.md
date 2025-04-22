# Arthas for VSCode

VSCode插件，用于快速复制Arthas命令。

## 安装

有两种安装方式：

1. 从 VSCode 商店安装
   - 访问 [VSCode 商店](https://marketplace.visualstudio.com/items?itemName=JustLookAtNow.arthas-for-vscode)
   - 或直接在 VSCode 扩展中搜索 `JustLookAtNow.arthas-for-vscode`

2. 手动安装
   - 从 [Release](https://github.com/JustLookAtNow/arthas-for-vscode/releases) 页面下载最新的 .vsix 文件
   - 在 VSCode 中选择"从 VSIX 安装"进行安装

## 功能

在Java文件中，当右键点击时，可以访问"Copy Arthas command"菜单，包含以下选项：

1. **watch** - 复制当前方法的Arthas watch命令
2. **jad** - 复制当前类的Arthas jad反编译命令

## 使用方法

### Watch命令

1. 打开Java文件
2. 以下三种方式可以使用watch命令：
   - 选中方法名，然后右键选择"Copy Arthas command" > "watch"
   - 将光标放在方法声明行，然后右键选择"Copy Arthas command" > "watch"
   - 将光标放在方法体内的任意位置，然后右键选择"Copy Arthas command" > "watch"
3. 命令会被复制到剪贴板中，格式为：
   ```
   watch 完整类路径 方法名 '{params,returnObj,throwExp}'  -n 5  -x 3
   ```

### Jad命令

1. 打开Java文件
2. 在文件中任意位置右键选择"Copy Arthas command" > "jad"
3. 命令会被复制到剪贴板中，格式为：
   ```
   jad 完整类路径
   ```

## 要求

- VSCode 1.96.0 或更高版本

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 打包
npm run vscode:prepublish
```

## 发布

```bash
# 安装 vsce
npm install -g vsce

# 打包
vsce package

# 发布
vsce publish
``` 