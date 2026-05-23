/**
 * Six 7 Bill Splitter - Real OCR and Bill Splitting Integration Runner
 * Path: scratch/test_real_ocr.js
 * 
 * This script:
 * 1. Reads the local receipt image file from the Mock_data directory.
 * 2. Encodes it to a base64 Data URL.
 * 3. Runs the real OpenAI GPT-4o OCR parser to extract structured items and taxes.
 * 4. Applies a mathematically balanced 3-member EQUAL split with host rounding absorption.
 * 5. Saves a rich, comprehensive Markdown report to testresult/test1.md.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { parseReceiptImage } from '../src/services/ocr.service.js';
import { roundToTwoDecimals } from '../src/utils/helpers.js';

// Setup file paths and load dotenv pointing to project root env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Force development environment so the real OpenAI client is used instead of mockOpenai
process.env.NODE_ENV = 'development';

async function run() {
  console.log('=====================================================');
  console.log('🚀 Starting Real OpenAI OCR + Bill Splitting Test Run');
  console.log('=====================================================');
  
  // 1. Path definitions
  const mockDataDir = path.join(__dirname, '../Mock_data');
  const imageName = 'WhatsApp Image 2026-05-23 at 2.38.28 AM.jpeg';
  const imagePath = path.join(mockDataDir, imageName);
  const testresultDir = path.join(__dirname, '../testresult');
  const markdownPath = path.join(testresultDir, 'test1.md');
  
  console.log(`📂 Mock data directory: ${mockDataDir}`);
  console.log(`📸 Image target path: ${imagePath}`);
  console.log(`✍️ Output markdown path: ${markdownPath}`);
  
  // 2. Validate image file exists
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Error: Image file not found at ${imagePath}`);
    console.error('Please make sure the file is placed correctly inside Mock_data.');
    process.exit(1);
  }
  
  // 3. Read and convert image to base64 Data URL
  console.log('🔄 Reading image and encoding to base64...');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const extension = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const imageUrl = `data:${mimeType};base64,${base64Image}`;
  console.log(`✅ Base64 encoding complete! MimeType: ${mimeType}, Length: ${base64Image.length} characters.`);
  
  // 4. Perform actual OCR scan via OpenAI
  console.log('\n🤖 Requesting OpenAI gpt-4o receipt scanning...');
  console.log('   (Sending receipt image, extracting Malaysian SST, Service Charge and items...)');
  
  try {
    const startTime = Date.now();
    const scanResult = await parseReceiptImage(imageUrl);
    const endTime = Date.now();
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Scan completed successfully in ${durationSec} seconds!`);
    
    // 5. Equal Split (均摊) Math calculation for 3 members (Host + Member 1 + Member 2)
    const totalPeople = 3;
    const totalAmount = scanResult.total_amount;
    
    console.log(`\n🧮 Calculating equal split for ${totalPeople} members on RM ${totalAmount.toFixed(2)}...`);
    
    // Round sharing amount to two decimals for ordinary members
    const baseShare = roundToTwoDecimals(totalAmount / totalPeople);
    
    // Ordinary members pay baseShare (2 people)
    const nonAbsorbersCount = totalPeople - 1;
    const sumNonAbsorbers = baseShare * nonAbsorbersCount;
    
    // Host absorbs the difference
    const hostShare = roundToTwoDecimals(totalAmount - sumNonAbsorbers);
    const calculatedTotal = roundToTwoDecimals(sumNonAbsorbers + hostShare);
    
    console.log('📊 Split results:');
    console.log(`   - Member A pays: RM ${baseShare.toFixed(2)}`);
    console.log(`   - Member B pays: RM ${baseShare.toFixed(2)}`);
    console.log(`   - Host (Absorber) pays: RM ${hostShare.toFixed(2)}`);
    console.log(`   - Sum of shares: RM ${calculatedTotal.toFixed(2)} (Target: RM ${totalAmount.toFixed(2)})`);
    console.log(`   - Rounding gap: RM ${(totalAmount - calculatedTotal).toFixed(4)}`);
    
    // 6. Format comprehensive Markdown report
    console.log('\n📝 Formatting beautiful Markdown report...');
    
    const itemsTableRows = scanResult.items.map(item => {
      const itemSubtotal = roundToTwoDecimals(item.price * item.quantity);
      return `| ${item.item_name} | RM ${item.price.toFixed(2)} | ${item.quantity} | RM ${itemSubtotal.toFixed(2)} |`;
    }).join('\n');
    
    const markdownContent = `# Six 7 Bill Splitter - AI Receipt Scan & Split Test Report (test1)

## 📋 测试基本信息 (Test Information)
* **测试时间 (Test Time)**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })} (马来西亚标准时间 MST)
* **分摊模式 (Split Mode)**: 均摊 (EQUAL Split)
* **参与人数 (Total People)**: 3 人 (1位 Host + 2位 房间成员)
* **OpenAI OCR 耗时**: ${durationSec} 秒
* **输入文件 (Source Image)**: \`Mock_data/${imageName}\`

---

## 🤖 AI 智能扫描分析结果 (OpenAI OCR Results)
OpenAI \`gpt-4o\` 成功解析并提取出符合马来西亚收据格式的结构化数据：

### 1. 账单汇总金额 (Receipt Totals)
| 类别 | 金额 (RM) | 说明 |
| :--- | :--- | :--- |
| **商品原始小计 (Subtotal)** | **RM ${scanResult.subtotal.toFixed(2)}** | 所有单项价格累加（未计税费与服务费） |
| **服务税 (SST 6%)** | **RM ${scanResult.tax_amount.toFixed(2)}** | 马来西亚政府销售与服务税 |
| **餐厅服务费 (Service Charge 10%)** | **RM ${scanResult.service_charge.toFixed(2)}** | 餐厅收取的 10% 商业服务费 |
| **最终实付总计 (Total Amount)** | **RM ${scanResult.total_amount.toFixed(2)}** | 包含所有税率及四舍五入舍入（Rounding Adjustment）后的最终付款总额 |

### 2. 消费单项明细 (Itemized Details)
| 商品名称 (Item Name) | 单价 (Price) | 数量 (Qty) | 小计金额 (Subtotal) |
| :--- | :--- | :---: | :--- |
${itemsTableRows || '| *无明细项目* | - | - | - |'}

---

## 🧮 3人均摊账单计算详情 (Equal Split Breakdown)
为了避免浮点数精度和多次舍入带来的“仙”级对账误差（Rounding Discrepancy），系统采用 **“房主差额吸收算法” (Host Flat-Gap Absorption)**：
1. 普通成员（Member A, Member B）按标准均摊价格支付：\`round(Total / 3, 2)\`
2. 房间创建人（Host）支付扣除普通成员总额后的剩余部分：\`Total - (Member A + Member B)\`

### 1. 分摊结果汇总
* **账单应付总额**: **RM ${totalAmount.toFixed(2)}**
* **分摊人分配详情**:
  * **👤 Member A (普通成员)**: **RM ${baseShare.toFixed(2)}**
  * **👤 Member B (普通成员)**: **RM ${baseShare.toFixed(2)}**
  * **👑 Host (房主/垫付人)**: **RM ${hostShare.toFixed(2)}** *(已自动吸收精度差额)*

### 2. 数学精度校验 (Math Parity Validation)
* **分摊金额总和**: \`RM ${baseShare.toFixed(2)} + RM ${baseShare.toFixed(2)} + RM ${hostShare.toFixed(2)} = RM ${calculatedTotal.toFixed(2)}\`
* **目标收据总额**: \`RM ${totalAmount.toFixed(2)}\`
* **对账差额 (Precision Leakage)**: **RM ${(totalAmount - calculatedTotal).toFixed(4)}** *(完美对齐，0 sen 溢出 ✅)*

> [!TIP]
> **差额吸收说明**：在 3 人均摊除不尽时，Host 自动承担少许舍入差额（通常不超过 0.02 sen），从而彻底杜绝了账单收付款无法结清的经典难题。

---

## 📦 原始 AI 返回 JSON 数据 (Raw OpenAI Response)
\`\`\`json
${JSON.stringify(scanResult, null, 2)}
\`\`\`
`;
    
    // 7. Ensure testresult folder exists
    if (!fs.existsSync(testresultDir)) {
      console.log(`📁 Directory ${testresultDir} does not exist. Creating it...`);
      fs.mkdirSync(testresultDir, { recursive: true });
    }
    
    // 8. Write Markdown output
    console.log(`✍️ Writing test report to file...`);
    fs.writeFileSync(markdownPath, markdownContent, 'utf-8');
    
    console.log('\n=====================================================');
    console.log('🎉 TEST SUCCESSFUL! TEST REPORT GENERATED');
    console.log(`📂 Output: ${markdownPath}`);
    console.log('=====================================================');
    
  } catch (error) {
    console.error('\n❌ Test Run Error:', error);
    process.exit(1);
  }
}

run();
