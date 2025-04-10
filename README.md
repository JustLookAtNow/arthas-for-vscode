# Arthas for VSCode

VSCode插件，用于快速复制Arthas的watch命令。

## 功能

在Java文件中，当右键点击方法名或在方法体内时，通过右键菜单可以复制对应的Arthas watch命令。

## 使用方法

1. 打开Java文件
2. 以下三种方式可以使用：
   - 选中方法名，然后右键选择"复制 Arthas watch 命令"
   - 将光标放在方法声明行，然后右键选择"复制 Arthas watch 命令"
   - 将光标放在方法体内的任意位置，然后右键选择"复制 Arthas watch 命令"
3. 命令会被复制到剪贴板中，格式为：
   ```
   watch 完整类路径 方法名 '{params,returnObj,throwExp}'  -n 5  -x 3
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