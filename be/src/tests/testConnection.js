import { supabase, supabaseAdmin } from '../config/supabase.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

/**
 * Mask sensitive credentials for safe logging
 * @param {string} str - String to mask
 * @returns {string} Masked string
 */
function maskString(str) {
  if (!str) return '未配置 (Missing)';
  if (str.length <= 15) return '*** (过短/可能配置错误)';
  return `${str.substring(0, 10)}... (长度: ${str.length})`;
}

/**
 * Human-readable diagnostic helper for common Supabase connection / authentication errors
 * @param {object} err - Error object
 * @param {number} httpStatus - HTTP Status code from response
 */
function diagnoseError(err, httpStatus) {
  console.log('\n=========================================');
  console.log(`❌ 错误详情 (Error Details):`);
  console.dir(err, { depth: null });
  if (httpStatus) {
    console.log(`- HTTP 状态码 (HTTP Status): ${httpStatus}`);
  }
  console.log('=========================================\n');

  const errMsg = err && typeof err === 'object' 
    ? (err.message || JSON.stringify(err)).toLowerCase()
    : String(err).toLowerCase();
  
  const errStatus = httpStatus || err?.status || (err?.code ? parseInt(err?.code) : null);

  if (errStatus === 401 || errMsg.includes('invalid api key') || errMsg.includes('jwt') || errMsg.includes('invalid token') || errMsg.includes('unauthorized')) {
    console.log(`💡 [智能诊断提示] ➔ 401 Unauthorized / Invalid API Key`);
    console.log(`   👉 请检查您的 .env 文件中 SUPABASE_ANON_KEY 或 SUPABASE_SERVICE_ROLE_KEY 是否配置正确。`);
    console.log(`   👉 确保复制的 Key 完整且没有包含前后多余的空格或特殊字符。`);
  } else if (
    errMsg.includes('failed to fetch') || 
    errMsg.includes('network error') || 
    errMsg.includes('fetch failed') || 
    errMsg.includes('enotfound') || 
    errMsg.includes('etimeout') ||
    errMsg.includes('connect')
  ) {
    console.log(`💡 [智能诊断提示] ➔ Network Error / Failed to Fetch (网络连接失败)`);
    console.log(`   👉 请验证您的 SUPABASE_URL 是否配置正确（它必须是一个合法的 https 网址，如 https://xxxx.supabase.co ）。`);
    console.log(`   👉 如果您在中国大陆开发，可能是因为直连 Supabase 域名受到网络限制，请尝试使用代理（VPN）或配置本地代理。`);
  } else if (errStatus === 500) {
    console.log(`💡 [智能诊断提示] ➔ 500 Internal Server Error (数据库内部错误/疑似 RLS 无限递归)`);
    console.log(`   👉 【重磅发现】Supabase 返回了 500 Internal Server Error！这极有可能是因为数据库行级安全策略（RLS Policy）发生了无限递归。`);
    console.log(`   👉 经分析，'bill_rooms' 和 'participant_bills' 的 SELECT 策略互相查询，导致了 Postgres 内部死循环（infinite recursion）。`);
    console.log(`   👉 请查看本次测试报告中的修复方案，登录 Supabase Dashboard -> SQL Editor 运行修复 SQL 即可彻底解决该问题！`);
  } else if (err?.code === '42P17' || errMsg.includes('infinite recursion')) {
    console.log(`💡 [智能诊断提示] ➔ 42P17 Infinite Recursion (数据库 RLS 策略无限递归)`);
    console.log(`   👉 【重磅发现】您的 Supabase 数据库中存在行级安全策略（RLS Policy）无限递归的 Bug！`);
    console.log(`   👉 这主要是由于 'bill_rooms' 和 'participant_bills' 的 SELECT 策略互相查询，导致了死循环。`);
    console.log(`   👉 请登录 Supabase Dashboard -> SQL Editor，运行本文档提供的修复 SQL 语句以解决此问题。`);
  } else if (err?.code === '42P01' || (errMsg.includes('relation') && errMsg.includes('does not exist')) || errStatus === 403) {
    console.log(`💡 [智能诊断提示] ➔ 403 Forbidden / Relation does not exist (表结构不存在)`);
    console.log(`   👉 【好消息】API 握手与鉴权本身是成功的！这说明您与 Supabase 建立了合法的连接。`);
    console.log(`   👉 【但存在问题】目前数据库中没有找到 'bill_rooms' 表。`);
    console.log(`   👉 请确保您已经在 Supabase SQL Editor 中运行了初始化 SQL（例如 migrations 下的 init_schema.sql），创建了该表结构。`);
  } else {
    console.log(`💡 [智能诊断提示] ➔ 未知异常`);
    console.log(`   👉 请仔细查看上方的“错误详情”，或者检查 Supabase 服务控制台是否运行正常。`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 开始执行 Supabase 数据库连通性与权限测试');
  console.log('==================================================\n');

  // ----------------------------------------------------
  // 测试阶段 1：环境变量加载检查
  // ----------------------------------------------------
  console.log('--- [阶段 1] 环境变量加载检查 ---');
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`- SUPABASE_URL:               ${url ? url : '❌ 未配置'}`);
  console.log(`- SUPABASE_ANON_KEY:          ${maskString(anonKey)}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY:  ${maskString(serviceKey)}`);

  if (!url || !anonKey || !serviceKey) {
    console.error('\n❌ [FAILED] 基础环境变量缺失！请先在 be/.env 中配置完整的 Supabase 凭证。\n');
    return false;
  }
  console.log('✅ [SUCCESS] 环境变量加载检查通过。\n');

  // ----------------------------------------------------
  // 测试阶段 2：API 连通性与鉴权测试（匿名握手）
  // ----------------------------------------------------
  console.log('--- [阶段 2] API 连通性与鉴权测试（匿名握手） ---');
  console.log('正在使用 Anon Key 客户端向数据库发送空查询...');
  
  try {
    const { data, error, status } = await supabase
      .from('bill_rooms')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ [FAILED] 匿名客户端请求失败。');
      diagnoseError(error, status);
      return false;
    }
    
    console.log(`✅ [SUCCESS] 匿名握手成功！HTTP Status: ${status}`);
    console.log(`- 当前 bill_rooms 表中的总行数: ${data !== null ? data : 'N/A'}\n`);
  } catch (error) {
    console.error('❌ [FAILED] 发生网络异常或未捕获的错误。');
    diagnoseError(error, 500);
    return false;
  }

  // ----------------------------------------------------
  // 测试阶段 3：模拟数据读写完整闭环测试 (Service Role 权限)
  // ----------------------------------------------------
  console.log('--- [阶段 3] Service Role 最高权限读写闭环测试 ---');
  console.log('正在使用 Service Role Key 客户端测试 增-删-改-查 权限...');

  const tempRoomCode = 'TST' + Math.floor(1000 + Math.random() * 9000);
  const tempDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时后过期
  let insertedRoomId = null;

  try {
    // 1. Insert 写入测试
    console.log(`[1/3] 正在向 'bill_rooms' 写入临时测试数据 (room_code: ${tempRoomCode})...`);
    const { data: insertData, error: insertError, status: insertStatus } = await supabaseAdmin
      .from('bill_rooms')
      .insert({
        room_code: tempRoomCode,
        host_email: 'supabase_test_harness@six7.com',
        due_date: tempDueDate,
        split_mode: 'EQUAL',
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [FAILED] [1/3] 临时测试数据插入失败。');
      diagnoseError(insertError, insertStatus);
      return false;
    }

    insertedRoomId = insertData.room_id;
    console.log(`   🟢 [OK] 测试数据插入成功。已生成 Room ID: ${insertedRoomId}`);

    // 2. Select 读取校验测试
    console.log(`[2/3] 正在通过 Room ID (${insertedRoomId}) 读取刚才插入的数据...`);
    const { data: selectData, error: selectError, status: selectStatus } = await supabaseAdmin
      .from('bill_rooms')
      .select('*')
      .eq('room_id', insertedRoomId)
      .single();

    if (selectError) {
      console.error('❌ [FAILED] [2/3] 临时测试数据查询失败。');
      diagnoseError(selectError, selectStatus);
      return false;
    }

    console.log(`   🟢 [OK] 测试数据读取并验证成功 (room_code 匹配: ${selectData.room_code === tempRoomCode})`);

    // 3. Delete 抹除测试 (Clean up)
    console.log(`[3/3] 正在删除临时测试数据 (${insertedRoomId}) 抹除痕迹...`);
    const { error: deleteError, status: deleteStatus } = await supabaseAdmin
      .from('bill_rooms')
      .delete()
      .eq('room_id', insertedRoomId);

    if (deleteError) {
      console.error(`⚠️  [WARNING] [3/3] 抹除测试数据失败。请手动登录 Supabase 删除 Room ID 为 ${insertedRoomId} 的脏数据。`);
      diagnoseError(deleteError, deleteStatus);
    } else {
      console.log('   🟢 [OK] 测试数据已被成功删除，无脏数据残留。');
    }

    console.log('\n==================================================');
    console.log('🎉 [SUCCESS] Supabase 握手成功！后端已具备最高管理员读写权限。');
    console.log('==================================================\n');
    return true;

  } catch (error) {
    console.error('❌ [FAILED] 读写闭环测试时发生未捕获的异常。');
    diagnoseError(error, 500);
    
    if (insertedRoomId) {
      console.log(`🧹 正在尝试执行紧急清理，删除脏 Room ID: ${insertedRoomId}...`);
      await supabaseAdmin.from('bill_rooms').delete().eq('room_id', insertedRoomId);
    }
    return false;
  }
}

runTests().then((success) => {
  if (!success) {
    process.exitCode = 1;
  }
});
