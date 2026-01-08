#!/bin/bash

# 配置参数
ARTEMIS_TOKEN="123456"
API_URL="https://fat-artemis-service.hellobike.cn/artemis/v1/openapi/configNew?productCode=cursor"
DOWNLOAD_DIR="./downloads"

# 创建下载目录
mkdir -p "$DOWNLOAD_DIR"

echo "正在获取配置信息..."

# 调用API获取配置
RESPONSE=$(wget --no-check-certificate --quiet \
  --method GET \
  --timeout=0 \
  --header "artemis-token: $ARTEMIS_TOKEN" \
  --header "Content-Type: application/json" \
  -O - \
  "$API_URL")

# 检查API调用是否成功
if [ $? -ne 0 ]; then
    echo "错误: API调用失败"
    exit 1
fi

# 检查响应是否为空
if [ -z "$RESPONSE" ]; then
    echo "错误: API返回空响应"
    exit 1
fi

echo "API响应:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# 提取downloadUrl
DOWNLOAD_URL=$(echo "$RESPONSE" | jq -r '.downloadUrl' 2>/dev/null)

# 如果jq不可用，使用grep和sed作为备选方案
if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
    echo "使用备选方案提取downloadUrl..."
    DOWNLOAD_URL=$(echo "$RESPONSE" | grep -o '"downloadUrl":"[^"]*"' | sed 's/"downloadUrl":"\([^"]*\)"/\1/')
fi

# 检查是否成功提取到downloadUrl
if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
    echo "错误: 无法从API响应中提取downloadUrl"
    echo "响应内容: $RESPONSE"
    exit 1
fi

echo "找到downloadUrl: $DOWNLOAD_URL"

# 从URL中提取文件名
FILENAME=$(basename "$DOWNLOAD_URL")
if [ -z "$FILENAME" ]; then
    FILENAME="config_$(date +%Y%m%d_%H%M%S).json"
fi

DOWNLOAD_PATH="$DOWNLOAD_DIR/$FILENAME"

echo "开始下载文件到: $DOWNLOAD_PATH"

# 下载文件
wget --no-check-certificate \
  --quiet \
  --show-progress \
  --timeout=0 \
  -O "$DOWNLOAD_PATH" \
  "$DOWNLOAD_URL"

# 检查下载是否成功
if [ $? -eq 0 ]; then
    echo "下载成功: $DOWNLOAD_PATH"
    echo "文件大小: $(ls -lh "$DOWNLOAD_PATH" | awk '{print $5}')"
else
    echo "错误: 文件下载失败"
    exit 1
fi
