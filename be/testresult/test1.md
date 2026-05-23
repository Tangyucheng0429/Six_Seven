# Six 7 Bill Splitter - AI Receipt Scan & Split Test Report (test1)

## 📋 测试基本信息 (Test Information)
* **测试时间 (Test Time)**: 2026/5/23 02:44:25 (马来西亚标准时间 MST)
* **分摊模式 (Split Mode)**: 均摊 (EQUAL Split)
* **参与人数 (Total People)**: 3 人 (1位 Host + 2位 房间成员)
* **OpenAI OCR 耗时**: 6.46 秒
* **输入文件 (Source Image)**: `Mock_data/WhatsApp Image 2026-05-23 at 2.38.28 AM.jpeg`

---

## 🤖 AI 智能扫描分析结果 (OpenAI OCR Results)
OpenAI `gpt-4o` 成功解析并提取出符合马来西亚收据格式的结构化数据：

### 1. 账单汇总金额 (Receipt Totals)
| 类别 | 金额 (RM) | 说明 |
| :--- | :--- | :--- |
| **商品原始小计 (Subtotal)** | **RM 50.90** | 所有单项价格累加（未计税费与服务费） |
| **服务税 (SST 6%)** | **RM 0.00** | 马来西亚政府销售与服务税 |
| **餐厅服务费 (Service Charge 10%)** | **RM 0.00** | 餐厅收取的 10% 商业服务费 |
| **最终实付总计 (Total Amount)** | **RM 50.90** | 包含所有税率及四舍五入舍入（Rounding Adjustment）后的最终付款总额 |

### 2. 消费单项明细 (Itemized Details)
| 商品名称 (Item Name) | 单价 (Price) | 数量 (Qty) | 小计金额 (Subtotal) |
| :--- | :--- | :---: | :--- |
| Shredded Chicken Prawn Hor Fun (Soup/Dry) | RM 10.90 | 1 | RM 10.90 |
| Extra Noodles, Soup | RM 1.40 | 1 | RM 1.40 |
| Prawn Wanton Egg Noodle (Soup/Dry) | RM 11.40 | 1 | RM 11.40 |
| Lemon 7UP (Cold) | RM 4.90 | 1 | RM 4.90 |
| Lemon Coke (Cold) | RM 4.90 | 1 | RM 4.90 |
| Teh O (Cold) | RM 4.90 | 1 | RM 4.90 |
| Prawn Noodle Meehoon Mee | RM 13.90 | 1 | RM 13.90 |

---

## 🧮 3人均摊账单计算详情 (Equal Split Breakdown)
为了避免浮点数精度和多次舍入带来的“仙”级对账误差（Rounding Discrepancy），系统采用 **“房主差额吸收算法” (Host Flat-Gap Absorption)**：
1. 普通成员（Member A, Member B）按标准均摊价格支付：`round(Total / 3, 2)`
2. 房间创建人（Host）支付扣除普通成员总额后的剩余部分：`Total - (Member A + Member B)`

### 1. 分摊结果汇总
* **账单应付总额**: **RM 50.90**
* **分摊人分配详情**:
  * **👤 Member A (普通成员)**: **RM 16.97**
  * **👤 Member B (普通成员)**: **RM 16.97**
  * **👑 Host (房主/垫付人)**: **RM 16.96** *(已自动吸收精度差额)*

### 2. 数学精度校验 (Math Parity Validation)
* **分摊金额总和**: `RM 16.97 + RM 16.97 + RM 16.96 = RM 50.90`
* **目标收据总额**: `RM 50.90`
* **对账差额 (Precision Leakage)**: **RM 0.0000** *(完美对齐，0 sen 溢出 ✅)*

> [!TIP]
> **差额吸收说明**：在 3 人均摊除不尽时，Host 自动承担少许舍入差额（通常不超过 0.02 sen），从而彻底杜绝了账单收付款无法结清的经典难题。

---

## 📦 原始 AI 返回 JSON 数据 (Raw OpenAI Response)
```json
{
  "subtotal": 50.9,
  "tax_amount": 0,
  "service_charge": 0,
  "total_amount": 50.9,
  "items": [
    {
      "item_name": "Shredded Chicken Prawn Hor Fun (Soup/Dry)",
      "price": 10.9,
      "quantity": 1
    },
    {
      "item_name": "Extra Noodles, Soup",
      "price": 1.4,
      "quantity": 1
    },
    {
      "item_name": "Prawn Wanton Egg Noodle (Soup/Dry)",
      "price": 11.4,
      "quantity": 1
    },
    {
      "item_name": "Lemon 7UP (Cold)",
      "price": 4.9,
      "quantity": 1
    },
    {
      "item_name": "Lemon Coke (Cold)",
      "price": 4.9,
      "quantity": 1
    },
    {
      "item_name": "Teh O (Cold)",
      "price": 4.9,
      "quantity": 1
    },
    {
      "item_name": "Prawn Noodle Meehoon Mee",
      "price": 13.9,
      "quantity": 1
    }
  ]
}
```
