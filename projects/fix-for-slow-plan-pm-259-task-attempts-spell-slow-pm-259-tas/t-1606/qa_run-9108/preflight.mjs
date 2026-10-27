import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import * as schema from '../../../../db/schema.ts';
import { formatTrace, traceOf } from '../../../../scripts/e2e-gesture-trace.ts';
const require=createRequire(`${process.cwd()}/package.json`);
const pool=new pg.Pool({connectionString:'postgresql://otohime:otohime@127.0.0.1:1/otohime'});
const db=drizzle({client:pool,schema});
const factory=drizzleAdapter(db,{provider:'pg',schema});
const auth=betterAuth({baseURL:'http://localhost:4027',secret:'qa-local-construction-placeholder-0123456789abcdef',database:factory,emailAndPassword:{enabled:true}});
const ctx=await auth.$context;
const browser=await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
try {
 console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,next:require('next/package.json').version,playwright:require('playwright-core/package.json').version,chrome:browser.version(),lock_sha256:createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),schemaTables:Object.keys(schema),drizzleAdapterConstructed:typeof factory==='function',betterAuthContextInitialized:!!ctx.internalAdapter,traceImports:formatTrace(traceOf([])),databaseQuery:'construction only; full production suites exercise migrated real Postgres'},null,2));
} finally {await browser.close();await pool.end();}
