# CodeGang Analysis Report (Plan Phase)

**Generated:** 2026-03-18T21:00:32.459Z
**Analysis Duration:** 3.5s

## Executive Summary

| Metric                   | Value                 |
| ------------------------ | --------------------- |
| Files Scanned            | 60                    |
| Total Findings           | 3249                  |
| Critical Issues          | 1                     |
| High Issues              | 1244                  |
| Medium Issues            | 1332                  |
| Low Issues               | 648                   |
| Security Score           | 75/100                |
| Code Quality Score       | 82/100                |
| Maintainability Score    | 116/100               |
| Avg Cognitive Complexity | 3.0                   |
| Technical Debt           | 13.2 days (105 hours) |

## Quality Gate

Status: **FAILED** ❌ (Level: standard)

### Gate Issues

- **CRITICAL** Critical Issues: 1 issue(s) (BLOCKING)
- **HIGH** High Severity: 1244 issue(s) (BLOCKING)
- **MEDIUM** Medium Severity: 1332 issue(s) (BLOCKING)
- **LOW** Low Severity: 672 issue(s) (BLOCKING)

### Suggestions

- **Fix critical security vulnerabilities immediately:** Critical vulnerabilities expose the system to immediate attack. These must be fixed before any deployment. (Action: Run security scan and apply recommended fixes)
- **Resolve high-severity issues:** High-severity issues can lead to data corruption, denial of service, or privilege escalation. (Action: Review and fix high-severity bugs in current sprint)
- **Address medium-severity technical debt:** Medium issues add technical debt and can become critical over time. Plan fixes for next iteration. (Action: Schedule refactoring for medium-priority issues)

## Findings

### Code Smells (6 findings)

🔴 critical: 1 | 🟠 high: 5

#### 🔴 [CRITICAL] Hook called conditionally

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:89`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** React Hooks must not be called conditionally — violates Rules of Hooks

```
if (user && user.username === username) {
```

**Fix:** Move hook calls to top level; use conditional logic inside the hook or pass condition as parameter

#### 🟠 [HIGH] React state management issue

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:170`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** React state pattern that may cause bugs or performance issues

```
{messages.length === 0 ? (
```

**Fix:** Use useMemo/useCallback, add proper dependencies, include keys

#### 🟠 [HIGH] Empty dependency array in useCallback/useMemo

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:64`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** Empty deps array captures initial values — may create stale closures when used with changing state

```
const onSelect = React.useCallback((api: CarouselApi) => {
```

**Fix:** Add all referenced variables to the dependency array, or use useRef for stable references

#### 🟠 [HIGH] React state management issue

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\chart.tsx:287`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** React state pattern that may cause bugs or performance issues

```
{payload.map((item) => {
```

**Fix:** Use useMemo/useCallback, add proper dependencies, include keys

#### 🟠 [HIGH] React state management issue

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-toast.ts:86`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** React state pattern that may cause bugs or performance issues

```
return {
```

**Fix:** Use useMemo/useCallback, add proper dependencies, include keys

#### 🟠 [HIGH] React state management issue

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-toast.ts:106`
- **Category:** Code Smells
- **Tool:** bug_detector
- **Description:** React state pattern that may cause bugs or performance issues

```
return {
```

**Fix:** Use useMemo/useCallback, add proper dependencies, include keys

### Security (2 findings)

🟠 high: 2

#### 🟠 [HIGH] Cross-site Scripting

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1656`
- **Category:** Security
- **Tool:** security_scanner
- **Description:** Potential XSS vulnerability - unsanitized HTML being rendered

```
<div dangerouslySetInnerHTML={{ __html: modalContent.body }} />
```

**Fix:** Sanitize HTML using DOMPurify or similar library before rendering

**References:**

- https://owasp.org/www-community/attacks/xss/

#### 🟠 [HIGH] Cross-site Scripting

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\chart.tsx:92`
- **Category:** Security
- **Tool:** security_scanner
- **Description:** Potential XSS vulnerability - unsanitized HTML being rendered

```
dangerouslySetInnerHTML={{
```

**Fix:** Sanitize HTML using DOMPurify or similar library before rendering

**References:**

- https://owasp.org/www-community/attacks/xss/

### Bugs (27 findings)

🟠 high: 27

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:105`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
socketInstance.disconnect();
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Potentially missing await

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:105`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Async function called without await — result may be an unresolved Promise

```
socketInstance.disconnect();
```

**Fix:** Add await keyword or handle the returned Promise

#### 🟠 [HIGH] Assignment used inside condition — likely accidental = instead of ===

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:88`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Using = inside if/while/for conditions often indicates a typo that changes control flow and mutates state unexpectedly

```
if (!prev.find(u => u.id === data.user.id)) {
```

**Fix:** Replace = with ===/!== if this is a comparison, or move the assignment out of the condition and make it explicit.

#### 🟠 [HIGH] Potentially missing await

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:100`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Async function called without await — result may be an unresolved Promise

```
users.delete(socket.id);
```

**Fix:** Add await keyword or handle the returned Promise

#### 🟠 [HIGH] Potentially missing await

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:106`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Async function called without await — result may be an unresolved Promise

```
console.log(`${user.username} left the chat room, current online users: ${users.size}`);
```

**Fix:** Add await keyword or handle the returned Promise

#### 🟠 [HIGH] Potentially missing await

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:22`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Async function called without await — result may be an unresolved Promise

```
z.on('error', reject);
```

**Fix:** Add await keyword or handle the returned Promise

#### 🟠 [HIGH] Unhandled promise rejection

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:13`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** .then() call without a .catch() handler — rejections will be silently swallowed

```
return new Promise((resolve, reject) => {
```

**Fix:** Add .catch(err => { ... }) or use try/catch with await

#### 🟠 [HIGH] JSON.parse without try/catch

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:88`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** JSON.parse throws SyntaxError on invalid input — unguarded call may crash at runtime

```
return JSON.parse(jsonMatch[0])
```

**Fix:** Wrap in try/catch: try { JSON.parse(data) } catch (e) { /_ handle _/ }

#### 🟠 [HIGH] JSON.parse without try/catch

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:183`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** JSON.parse throws SyntaxError on invalid input — unguarded call may crash at runtime

```
return JSON.parse(jsonMatch[0])
```

**Fix:** Wrap in try/catch: try { JSON.parse(data) } catch (e) { /_ handle _/ }

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:915`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Variable may be null or undefined when accessed

```
const stepsHtml = s.steps.map(st => `<li>${st}</li>`).join('')
```

**Fix:** Add null checks using optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:686`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
document.addEventListener('mousedown', handleClickOutside)
```

**Fix:** Remove event listeners and clear intervals when component unmounts

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:974`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
const interval = setInterval(pushRadarItem, 5000 + Math.random() * 5000)
```

**Fix:** Remove event listeners and clear intervals when component unmounts

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:981`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
const interval = setInterval(() => {
```

**Fix:** Remove event listeners and clear intervals when component unmounts

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:991`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
const interval = setInterval(() => {
```

**Fix:** Remove event listeners and clear intervals when component unmounts

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:910`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
setModalOpen(true)
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:920`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
setModalOpen(true)
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1611`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
<button className="chat-close" onClick={() => setChatOpen(false)}>✕</button>
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Subscription/resource leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:805`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Subscription or resource created but may not be cleaned up

```
const response = await fetch('/api/ai', {
```

**Fix:** Use AbortController, unsubscribe on cleanup, or use takeUntil pattern

#### 🟠 [HIGH] Subscription/resource leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:848`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Subscription or resource created but may not be cleaned up

```
const response = await fetch('/api/ai', {
```

**Fix:** Use AbortController, unsubscribe on cleanup, or use takeUntil pattern

#### 🟠 [HIGH] setInterval without clearInterval

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:974`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** setInterval ID stored in variable but clearInterval never called — timer will run forever

```
const interval = setInterval(pushRadarItem, 5000 + Math.random() * 5000)
```

**Fix:** Call clearInterval(id) in cleanup function (useEffect return, componentWillUnmount, or finally)

#### 🟠 [HIGH] setInterval without clearInterval

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:981`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** setInterval ID stored in variable but clearInterval never called — timer will run forever

```
const interval = setInterval(() => {
```

**Fix:** Call clearInterval(id) in cleanup function (useEffect return, componentWillUnmount, or finally)

#### 🟠 [HIGH] setInterval without clearInterval

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:991`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** setInterval ID stored in variable but clearInterval never called — timer will run forever

```
const interval = setInterval(() => {
```

**Fix:** Call clearInterval(id) in cleanup function (useEffect return, componentWillUnmount, or finally)

#### 🟠 [HIGH] JSON.parse without try/catch

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:629`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** JSON.parse throws SyntaxError on invalid input — unguarded call may crash at runtime

```
if (saved) return JSON.parse(saved)
```

**Fix:** Wrap in try/catch: try { JSON.parse(data) } catch (e) { /_ handle _/ }

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:108`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
window.addEventListener("keydown", handleKeyDown)
```

**Fix:** Remove event listeners and clear intervals when component unmounts

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:82`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
_setOpen(openState)
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Resource not properly closed

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:93`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** File handle, connection, or stream may not be released

```
return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
```

**Fix:** Use try-finally, with statements, or async dispose pattern

#### 🟠 [HIGH] Potential memory leak

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-mobile.ts:13`
- **Category:** Bugs
- **Tool:** bug_detector
- **Description:** Event listener or timer not cleaned up

```
mql.addEventListener("change", onChange)
```

**Fix:** Remove event listeners and clear intervals when component unmounts

### Edge Cases (462 findings)

🟠 high: 462

#### 🟠 [HIGH] Division or mathematical operation without zero check

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:4`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Division by zero or invalid math operations may cause errors

```
import { Button } from '@/components/ui/button';
```

**Fix:** Add zero check for divisors, validate inputs for mathematical functions

#### 🟠 [HIGH] Division or mathematical operation without zero check

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:5`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Division by zero or invalid math operations may cause errors

```
import { Input } from '@/components/ui/input';
```

**Fix:** Add zero check for divisors, validate inputs for mathematical functions

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:110`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
if (socket && username.trim() && isConnected) {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:117`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
if (socket && inputMessage.trim() && username.trim()) {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:3`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
import { io } from 'socket.io-client';
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:9`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
const handleKeyPress = (e: React.KeyboardEvent) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:10`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
if (e.key === 'Enter') {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:27`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
disabled={!isConnected || !inputMessage.trim()}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:73`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('connect', () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:77`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('disconnect', () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:81`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('message', (msg: Message) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:85`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('user-joined', (data: { user: User; message: Message }) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:95`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('user-left', (data: { user: User; message: Message }) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:100`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.on('users-list', (data: { users: User[] }) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:105`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socketInstance.disconnect();
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:120`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
username: username.trim()
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:126`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
const handleKeyPress = (e: React.KeyboardEvent) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:148`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
onChange={(e) => setUsername(e.target.value)}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:150`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
if (e.key === 'Enter') {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:160`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
disabled={!isConnected || !username.trim()}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:170`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
{messages.length === 0 ? (
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:177`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
<p className={`text-sm font-medium ${msg.type === 'system'
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:181`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
{msg.username}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:187`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
{msg.content}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:191`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
{new Date(msg.timestamp).toLocaleTimeString()}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:203`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
onChange={(e) => setInputMessage(e.target.value)}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:211`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
disabled={!isConnected || !inputMessage.trim()}
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Async state management issues

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:58`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Async operations may complete after component unmount or state change

```
useEffect(() => {
```

**Fix:** Use cleanup tokens, AbortController, or check mounted state

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:89`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
if (user && user.username === username) {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:2`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
import { Server } from 'socket.io'
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:31`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
const generateMessageId = () => Math.random().toString(36).substr(2, 9)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:49`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
io.on('connection', (socket) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:50`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
console.log(`User connected: ${socket.id}`)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:55`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socket.emit('test-response', {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:62`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socket.on('join', (data: { username: string }) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:67`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
id: socket.id,
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:72`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
users.set(socket.id, user)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:76`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
io.emit('user-joined', { user, message: joinMessage })
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:80`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socket.emit('users-list', { users: usersList })
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:91`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
io.emit('message', message)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:95`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
/socket.on('disconnect', () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:100`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
users.delete(socket.id);
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:106`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
console.log(`${user.username} left the chat room, current online users: ${users.size}`);
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:113`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
console.log(`User disconnected: ${socket.id}`)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:117`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
socket.on('error', (error) => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:123`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
httpServer.listen(PORT, () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:128`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
process.on('SIGTERM', () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:130`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
httpServer.close(() => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:136`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
process.on('SIGINT', () => {
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

#### 🟠 [HIGH] Potential null/undefined access

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:140`
- **Category:** Edge Cases
- **Tool:** edge_case_analyzer
- **Description:** Property access may fail if object is null/undefined

```
process.exit(0)
```

**Fix:** Use optional chaining (?.) or nullish coalescing (??)

> _...and 412 more edge cases findings (see JSON report for full list)_

### Performance (3 findings)

🟠 high: 3

#### 🟠 [HIGH] Potential resource exhaustion

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1366`
- **Category:** Performance
- **Tool:** edge_case_analyzer
- **Description:** Code may exhaust resources with certain inputs

```
{actions.filter(a => a.category === 'immediate').map(action => (
```

**Fix:** Add limits on input size, use iteration instead of recursion, implement timeouts

#### 🟠 [HIGH] Potential resource exhaustion

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1391`
- **Category:** Performance
- **Tool:** edge_case_analyzer
- **Description:** Code may exhaust resources with certain inputs

```
{actions.filter(a => a.category === 'week').map(action => (
```

**Fix:** Add limits on input size, use iteration instead of recursion, implement timeouts

#### 🟠 [HIGH] Potential resource exhaustion

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1416`
- **Category:** Performance
- **Tool:** edge_case_analyzer
- **Description:** Code may exhaust resources with certain inputs

```
{actions.filter(a => a.category === 'upcoming').map(action => (
```

**Fix:** Add limits on input size, use iteration instead of recursion, implement timeouts

## Findings by File

| File                                                                 | Critical | High | Medium | Low | Total |
| -------------------------------------------------------------------- | -------- | ---- | ------ | --- | ----- |
| `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx`                   | 0        | 233  | 0      | 0   | 233   |
| `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts`            | 0        | 48   | 0      | 0   | 48    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\calendar.tsx`     | 0        | 41   | 0      | 0   | 41    |
| `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx`    | 0        | 32   | 0      | 0   | 32    |
| `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts`       | 1        | 28   | 0      | 0   | 29    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx` | 0        | 25   | 0      | 0   | 25    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx`   | 0        | 15   | 0      | 0   | 15    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx`    | 0        | 13   | 0      | 0   | 13    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\card.tsx`         | 0        | 10   | 0      | 0   | 10    |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx`        | 0        | 9    | 0      | 0   | 9     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\avatar.tsx`       | 0        | 9    | 0      | 0   | 9     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\button.tsx`       | 0        | 8    | 0      | 0   | 8     |
| `C:\Users\User\Desktop\OTM Agent\src\app\layout.tsx`                 | 0        | 7    | 0      | 0   | 7     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\badge.tsx`        | 0        | 7    | 0      | 0   | 7     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx`      | 0        | 3    | 0      | 0   | 3     |
| `C:\Users\User\Desktop\OTM Agent\src\app\api\route.ts`               | 0        | 3    | 0      | 0   | 3     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\chart.tsx`        | 0        | 2    | 0      | 0   | 2     |
| `C:\Users\User\Desktop\OTM Agent\src\hooks\use-toast.ts`             | 0        | 2    | 0      | 0   | 2     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\aspect-ratio.tsx` | 0        | 2    | 0      | 0   | 2     |
| `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx`     | 0        | 1    | 0      | 0   | 1     |
| `C:\Users\User\Desktop\OTM Agent\src\hooks\use-mobile.ts`            | 0        | 1    | 0      | 0   | 1     |

## Recommendations

### 🟠 [HIGH] High Severity Bugs

27 high severity bugs detected that may cause runtime errors.

**Actions:**

- Add null checks and error handling
- Review race conditions and async code
- Add comprehensive test coverage

### 🟡 [MEDIUM] Code Quality Issues

235 code quality issues detected.

**Actions:**

- Refactor complex methods
- Add documentation for complex logic
- Reduce code duplication

### 🟡 [MEDIUM] Edge Case Handling

Several edge cases may not be properly handled.

**Actions:**

- Add boundary condition tests
- Validate input ranges
- Handle null/empty cases explicitly

## Test Suggestions

- Test with null, undefined, empty string
- Test with arrays and objects
- Test with strings containing non-numeric chars
- Test with leading zeros and hex notation
- Test with divisor = 0
- Test with negative numbers for sqrt
- Test with very large numbers
- Test with floating point edge cases (0.1 + 0.2)
- Test with invalid date strings
- Test across DST boundaries
- Test with different timezones
- Test leap year scenarios (Feb 29)
- Test with multiple timezones
- Test across DST transitions
- Test with non-hour offsets
- Test with historical dates
- Test with null input
- Test with undefined input
- Test with empty object
- Test with objects with null prototype
- Test with empty object {}
- Test with empty array []
- Test with empty Map/Set
- Test reduce without initial value
- Test component unmount during async op
- Test rapid successive calls
- Test with slow network
- Test cleanup function execution
- Test rapid state updates
- Test stale closure scenarios
- Test unmount during update
- Test object comparison issues
- Test with null/undefined input
- Test with inherited properties
- Test with Symbol keys
- Test with frozen objects
- Test with missing arguments
- Test with extra arguments
- Test default parameter edge cases
- Test this binding in callbacks
- Test constructor behavior
- Test state updates in rapid succession
- Test derived state calculations
- Test component unmount during update
- Test with closure capturing old state
- Test lazy initializer behavior
- Test around DST transitions
- Test February 28/29/March 1
- Test year boundaries
- Test with various timezones
- Test invalid date inputs
- Test with single-element array
- Test with array containing undefined/null
- Test concurrent modification scenarios
- Test Promise.race with empty array
- Test with all promises rejecting
- Test with slow promises
- Test with promises that never settle
- Test sort with various orderings
- Test with already sorted arrays
- Test nested array deep copy
- Test iteration safety
- Test reference vs value behavior
- Test network timeout handling
- Test invalid JSON response
- Test 204 No Content
- Test redirect handling
- Test request cancellation
- Test CORS scenarios
- Test with invalid JSON string
- Test with empty string
- Test with undefined/null input
- Test with truncated JSON
- Test with HTML content
- Test with slow/resolving promises
- Test promise rejection handling
- Test async return values
- Test finally block behavior
- Test with abort controller
- Test with negative indices
- Test with indices > array.length
- Test with start > end
- Test with undefined indices
- Test with 0.1, 0.2, 0.3
- Test with numbers > 2^53
- Test toFixed() return type
- Test + operator with mixed types
- Test with string that doesn't match pattern
- Test with unicode/emoji strings
- Test with very long strings
- Test with very large input
- Test deep recursion
- Test with slow operations
- Test resource limits
- Test with timeout
- Test with network error
- Test with malformed response
- Test offline scenario
- Test floating point arithmetic
- Test boundary values (MAX_SAFE_INTEGER)
- Test division edge cases
- Test modulo with negative numbers
- Test NaN and Infinity handling
- Test with 404 response
- Test with 500 response
- Test with non-JSON error body
- Test with redirect response
- Test with simulated timeout
- Test abort signal cancellation
- Test cleanup on component unmount
- Test concurrent request management
- Test with tr-TR locale (Turkish dotless i)
- Test with ar-SA locale (Arabic number formatting)
- Test with sv-SE locale (Swedish collation)
- Test with C/POSIX locale (typical CI environment)
- Compare server-rendered vs client-rendered output across locales
- Test decimal input with a leading zero
- Test hexadecimal-looking input like "0x10"
- Verify invalid input does not partially parse
- Test that errors are properly caught
- Test error message content
- Test error propagation
- Test nested error scenarios
- Test with missing env vars
- Test with empty env vars
- Test with invalid config values
- Test with missing config file

## Auto-Fix Patches

426 auto-fix patch(es) were generated.

### PATCH-FIX-006-1773867632455-uzy9

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1291`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>📡</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 245
```

### PATCH-FIX-006-1773867632455-gnx9

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1299`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>💬</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 185
```

### PATCH-FIX-006-1773867632455-f9lg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1307`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>🛠️</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 139
```

### PATCH-FIX-006-1773867632455-13u0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1315`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>📈</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 239
```

### PATCH-FIX-006-1773867632456-cqx9

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:9`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
frontend.tsx:9, frontend.tsx:125
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-ecw8

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:10`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
frontend.tsx:10, frontend.tsx:127
```

**Fixed:**

```
/* TODO: Extract to named constant */ 127
```

### PATCH-FIX-006-1773867632456-72b4

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:24`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
frontend.tsx:24, frontend.tsx:208
```

**Fixed:**

```
/* TODO: Extract to named constant */ 208
```

### PATCH-FIX-006-1773867632456-urft

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:25`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
frontend.tsx:25, frontend.tsx:209
```

**Fixed:**

```
/* TODO: Extract to named constant */ 209
```

### PATCH-FIX-006-1773867632456-ppx8

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:127`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:127, server.ts:135
```

**Fixed:**

```
/* TODO: Extract to named constant */ 127
```

### PATCH-FIX-006-1773867632456-uybn

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:130`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:130, server.ts:138
```

**Fixed:**

```
/* TODO: Extract to named constant */ 130
```

### PATCH-FIX-006-1773867632456-c49n

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:146`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:146, server.ts:174
```

**Fixed:**

```
/* TODO: Extract to named constant */ 146
```

### PATCH-FIX-006-1773867632456-vy54

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:154`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:154, server.ts:171
```

**Fixed:**

```
/* TODO: Extract to named constant */ 154
```

### PATCH-FIX-006-1773867632456-hmrv

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:155`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:155, server.ts:172
```

**Fixed:**

```
/* TODO: Extract to named constant */ 155
```

### PATCH-FIX-006-1773867632456-vg81

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:162`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:162, server.ts:185
```

**Fixed:**

```
/* TODO: Extract to named constant */ 162
```

### PATCH-FIX-006-1773867632456-gju2

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:165, server.ts:200
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-zbjr

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:179`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:179, server.ts:186
```

**Fixed:**

```
/* TODO: Extract to named constant */ 179
```

### PATCH-FIX-006-1773867632456-maep

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:180`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:180, server.ts:187
```

**Fixed:**

```
/* TODO: Extract to named constant */ 180
```

### PATCH-FIX-006-1773867632456-u1a5

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:159`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:159, server.ts:194
```

**Fixed:**

```
/* TODO: Extract to named constant */ 159
```

### PATCH-FIX-006-1773867632456-cp0q

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:161`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:161, server.ts:197
```

**Fixed:**

```
/* TODO: Extract to named constant */ 161
```

### PATCH-FIX-006-1773867632456-l1h6

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:159`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
server.ts:159, server.ts:194
```

**Fixed:**

```
/* TODO: Extract to named constant */ 159
```

### PATCH-FIX-006-1773867632456-fa4d

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:29`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:29, page.tsx:125
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-7lsn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:30`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:30, page.tsx:126
```

**Fixed:**

```
/* TODO: Extract to named constant */ 126
```

### PATCH-FIX-006-1773867632456-5win

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:35`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:35, page.tsx:131
```

**Fixed:**

```
/* TODO: Extract to named constant */ 131
```

### PATCH-FIX-006-1773867632456-3fdw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:73`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:73, route.ts:169
```

**Fixed:**

```
/* TODO: Extract to named constant */ 169
```

### PATCH-FIX-006-1773867632456-d5pc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:83`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:83, route.ts:178
```

**Fixed:**

```
/* TODO: Extract to named constant */ 178
```

### PATCH-FIX-006-1773867632456-yp1s

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:179`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:179, route.ts:82
```

**Fixed:**

```
/* TODO: Extract to named constant */ 179
```

### PATCH-FIX-006-1773867632456-q882

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:29`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:29, page.tsx:125
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-n5yp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:31`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
route.ts:31, page.tsx:127
```

**Fixed:**

```
/* TODO: Extract to named constant */ 127
```

### PATCH-FIX-006-1773867632456-ssd2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:19`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:19, page.tsx:399
```

**Fixed:**

```
/* TODO: Extract to named constant */ 399
```

### PATCH-FIX-006-1773867632456-if9o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:20`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:20, page.tsx:400
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632456-3zrm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:124`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:124, page.tsx:134
```

**Fixed:**

```
/* TODO: Extract to named constant */ 124
```

### PATCH-FIX-006-1773867632456-irpz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:198`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:198, page.tsx:206
```

**Fixed:**

```
/* TODO: Extract to named constant */ 198
```

### PATCH-FIX-006-1773867632456-ghhc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:200`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:200, page.tsx:208
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632456-dz93

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:281`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:281, page.tsx:297, page.tsx:313, page.tsx:329, page.tsx:345, page.tsx:361
```

**Fixed:**

```
/* TODO: Extract to named constant */ 281
```

### PATCH-FIX-006-1773867632456-e969

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:285`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:285, page.tsx:301, page.tsx:317, page.tsx:333, page.tsx:349, page.tsx:365
```

**Fixed:**

```
/* TODO: Extract to named constant */ 285
```

### PATCH-FIX-006-1773867632456-r66z

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:322`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:322, page.tsx:354
```

**Fixed:**

```
/* TODO: Extract to named constant */ 322
```

### PATCH-FIX-006-1773867632456-ef1i

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:344`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:344, page.tsx:360
```

**Fixed:**

```
/* TODO: Extract to named constant */ 344
```

### PATCH-FIX-006-1773867632456-qghb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:427`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:427, page.tsx:438, page.tsx:449, page.tsx:460, page.tsx:471, page.tsx:482, page.tsx:493, page.tsx:504
```

**Fixed:**

```
/* TODO: Extract to named constant */ 427
```

### PATCH-FIX-006-1773867632456-t0qx

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:434`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:434, page.tsx:445, page.tsx:456, page.tsx:467, page.tsx:478, page.tsx:489, page.tsx:500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 434
```

### PATCH-FIX-006-1773867632456-zcoi

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:435`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:435, page.tsx:446, page.tsx:457, page.tsx:468, page.tsx:479, page.tsx:490, page.tsx:501
```

**Fixed:**

```
/* TODO: Extract to named constant */ 435
```

### PATCH-FIX-006-1773867632456-me6a

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:803`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:803, page.tsx:846
```

**Fixed:**

```
/* TODO: Extract to named constant */ 803
```

### PATCH-FIX-006-1773867632456-j579

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:805`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:805, page.tsx:848
```

**Fixed:**

```
/* TODO: Extract to named constant */ 805
```

### PATCH-FIX-006-1773867632456-c3ny

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:816`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:816, page.tsx:860
```

**Fixed:**

```
/* TODO: Extract to named constant */ 816
```

### PATCH-FIX-006-1773867632456-6saf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:891`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:891, page.tsx:899
```

**Fixed:**

```
/* TODO: Extract to named constant */ 891
```

### PATCH-FIX-006-1773867632456-u1zp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1152`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1152, page.tsx:1434
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1152
```

### PATCH-FIX-006-1773867632456-zvor

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1178`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1178, page.tsx:1538, page.tsx:1570
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1178
```

### PATCH-FIX-006-1773867632456-m9hs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1227`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1227, page.tsx:1240
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1227
```

### PATCH-FIX-006-1773867632456-wgnv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1364`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1364, page.tsx:1389, page.tsx:1414
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1364
```

### PATCH-FIX-006-1773867632456-h9y9

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1365`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1365, page.tsx:1390, page.tsx:1415
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1365
```

### PATCH-FIX-006-1773867632456-g346

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1370`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1370, page.tsx:1395, page.tsx:1420
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1370
```

### PATCH-FIX-006-1773867632456-sj0y

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1375`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1375, page.tsx:1400, page.tsx:1425
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1375
```

### PATCH-FIX-006-1773867632456-0286

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1381`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1381, page.tsx:1406
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1381
```

### PATCH-FIX-006-1773867632456-sqju

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:281`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:281, page.tsx:297, page.tsx:313, page.tsx:329, page.tsx:345, page.tsx:361
```

**Fixed:**

```
/* TODO: Extract to named constant */ 281
```

### PATCH-FIX-006-1773867632456-wauu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:285`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:285, page.tsx:301, page.tsx:317, page.tsx:333, page.tsx:349
```

**Fixed:**

```
/* TODO: Extract to named constant */ 285
```

### PATCH-FIX-006-1773867632456-rhvt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:318`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:318, page.tsx:350
```

**Fixed:**

```
/* TODO: Extract to named constant */ 318
```

### PATCH-FIX-006-1773867632456-uz4q

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:344`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:344, page.tsx:360
```

**Fixed:**

```
/* TODO: Extract to named constant */ 344
```

### PATCH-FIX-006-1773867632456-ew77

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:434`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:434, page.tsx:445, page.tsx:456, page.tsx:467, page.tsx:478, page.tsx:489, page.tsx:500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 434
```

### PATCH-FIX-006-1773867632456-cljk

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1364`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1364, page.tsx:1389, page.tsx:1414
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1364
```

### PATCH-FIX-006-1773867632456-nadf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1365`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1365, page.tsx:1390, page.tsx:1415
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1365
```

### PATCH-FIX-006-1773867632456-dnd4

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1370`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1370, page.tsx:1395, page.tsx:1420
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1370
```

### PATCH-FIX-006-1773867632456-y0v1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1375`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1375, page.tsx:1400, page.tsx:1425
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1375
```

### PATCH-FIX-006-1773867632456-l0k9

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:313`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:313, page.tsx:345
```

**Fixed:**

```
/* TODO: Extract to named constant */ 313
```

### PATCH-FIX-006-1773867632456-qcl5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1364`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1364, page.tsx:1389, page.tsx:1414
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1364
```

### PATCH-FIX-006-1773867632456-6xp7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1365`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1365, page.tsx:1390, page.tsx:1415
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1365
```

### PATCH-FIX-006-1773867632456-0k40

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1370`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
page.tsx:1370, page.tsx:1395, page.tsx:1420
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1370
```

### PATCH-FIX-006-1773867632456-7hn5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:13`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
accordion.tsx:13, command.tsx:140, navigation-menu.tsx:46, radio-group.tsx:20
```

**Fixed:**

```
/* TODO: Extract to named constant */ 140
```

### PATCH-FIX-006-1773867632456-xr7p

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:21`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
accordion.tsx:21, alert-dialog.tsx:72, alert-dialog.tsx:101, alert-dialog.tsx:114, avatar.tsx:30, breadcrumb.tsx:27, breadcrumb.tsx:45, card.tsx:34, card.tsx:44, card.tsx:67, card.tsx:77, command.tsx:135, context-menu.tsx:213, dialog.tsx:86, dialog.tsx:112, dialog.tsx:125, drawer.tsx:91, drawer.tsx:104, drawer.tsx:117, dropdown-menu.tsx:181, input-otp.tsx:32, menubar.tsx:190, navigation-menu.tsx:54, pagination.tsx:16, pagination.tsx:29, radio-group.tsx:15, select.tsx:94, select.tsx:131, sheet.tsx:87, sheet.tsx:97, sheet.tsx:110, sheet.tsx:123, skeleton.tsx:6, table.tsx:25, table.tsx:35, table.tsx:100, tabs.tsx:14, tabs.tsx:59
```

**Fixed:**

```
/* TODO: Extract to named constant */ 101
```

### PATCH-FIX-006-1773867632456-vtbd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:25`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
accordion.tsx:25, accordion.tsx:47, breadcrumb.tsx:31, breadcrumb.tsx:62, calendar.tsx:172, context-menu.tsx:53, context-menu.tsx:111, context-menu.tsx:134, context-menu.tsx:160, context-menu.tsx:184, dialog.tsx:46, drawer.tsx:45, dropdown-menu.tsx:68, dropdown-menu.tsx:91, dropdown-menu.tsx:128, dropdown-menu.tsx:152, input-otp.tsx:36, menubar.tsx:88, menubar.tsx:111, menubar.tsx:137, menubar.tsx:161, select.tsx:50, select.tsx:98, sheet.tsx:44, sidebar.tsx:253, toggle-group.tsx:40
```

**Fixed:**

```
/* TODO: Extract to named constant */ 172
```

### PATCH-FIX-006-1773867632456-munw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:36`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
accordion.tsx:36, alert-dialog.tsx:37, alert-dialog.tsx:55, alert-dialog.tsx:85, alert.tsx:40, alert.tsx:56, avatar.tsx:14, avatar.tsx:43, breadcrumb.tsx:14, card.tsx:8, card.tsx:21, card.tsx:54, checkbox.tsx:15, command.tsx:22, command.tsx:74, command.tsx:91, command.tsx:119, command.tsx:148, command.tsx:164, context-menu.tsx:86, context-menu.tsx:103, context-menu.tsx:170, context-menu.tsx:226, dialog.tsx:39, dialog.tsx:61, dialog.tsx:96, drawer.tsx:38, drawer.tsx:78, dropdown-menu.tsx:138, dropdown-menu.tsx:194, dropdown-menu.tsx:240, label.tsx:14, menubar.tsx:15, menubar.tsx:57, menubar.tsx:147, menubar.tsx:203, menubar.tsx:249, navigation-menu.tsx:38, navigation-menu.tsx:113, navigation-menu.tsx:130, navigation-menu.tsx:146, progress.tsx:15, radio-group.tsx:28, resizable.tsx:15, resizable.tsx:40, select.tsx:108, select.tsx:144, select.tsx:162, sheet.tsx:37, sidebar.tsx:171, switch.tsx:14, table.tsx:45, table.tsx:58, table.tsx:71, table.tsx:84, tabs.tsx:27, tabs.tsx:43, textarea.tsx:8
```

**Fixed:**

```
/* TODO: Extract to named constant */ 119
```

### PATCH-FIX-006-1773867632456-tsl2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:28`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:28, alert-dialog.tsx:44, alert-dialog.tsx:63, alert-dialog.tsx:76, alert-dialog.tsx:92, alert-dialog.tsx:105, alert-dialog.tsx:118, alert-dialog.tsx:130, alert.tsx:47, avatar.tsx:21, avatar.tsx:34, breadcrumb.tsx:80, command.tsx:60, command.tsx:82, command.tsx:110, command.tsx:126, command.tsx:139, command.tsx:155, context-menu.tsx:77, context-menu.tsx:93, context-menu.tsx:204, context-menu.tsx:217, dialog.tsx:103, dialog.tsx:116, drawer.tsx:95, drawer.tsx:108, dropdown-menu.tsx:172, dropdown-menu.tsx:185, dropdown-menu.tsx:231, form.tsx:87, menubar.tsx:48, menubar.tsx:181, menubar.tsx:194, menubar.tsx:240, navigation-menu.tsx:29, navigation-menu.tsx:45, navigation-menu.tsx:82, navigation-menu.tsx:99, navigation-menu.tsx:121, navigation-menu.tsx:137, pagination.tsx:20, pagination.tsx:65, pagination.tsx:82, pagination.tsx:99, radio-group.tsx:19, select.tsx:85, select.tsx:122, select.tsx:135, select.tsx:153, sheet.tsx:101, sheet.tsx:114, sidebar.tsx:318, sidebar.tsx:354, sidebar.tsx:437, sidebar.tsx:577, sidebar.tsx:652, table.tsx:91, tabs.tsx:18, tabs.tsx:34, tabs.tsx:50
```

**Fixed:**

```
/* TODO: Extract to named constant */ 105
```

### PATCH-FIX-006-1773867632456-h72j

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:64`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:64, alert-dialog.tsx:77, alert.tsx:48, breadcrumb.tsx:81, command.tsx:156, context-menu.tsx:218, dropdown-menu.tsx:186, menubar.tsx:195, pagination.tsx:21, pagination.tsx:100, sidebar.tsx:438, sidebar.tsx:578, sidebar.tsx:653, table.tsx:92
```

**Fixed:**

```
/* TODO: Extract to named constant */ 156
```

### PATCH-FIX-006-1773867632456-d4ry

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:65`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:65, alert-dialog.tsx:78, alert.tsx:49, breadcrumb.tsx:82, command.tsx:157, context-menu.tsx:219, dropdown-menu.tsx:187, menubar.tsx:196, pagination.tsx:22, pagination.tsx:101, sidebar.tsx:439, sidebar.tsx:579, sidebar.tsx:654, table.tsx:93
```

**Fixed:**

```
/* TODO: Extract to named constant */ 157
```

### PATCH-FIX-006-1773867632456-79py

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:93`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:93, dialog.tsx:104, drawer.tsx:96, sheet.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 104
```

### PATCH-FIX-006-1773867632456-j66y

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:106`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:106, dialog.tsx:117, drawer.tsx:109, sheet.tsx:115
```

**Fixed:**

```
/* TODO: Extract to named constant */ 106
```

### PATCH-FIX-006-1773867632456-kjh3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:115`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:115, card.tsx:45, dialog.tsx:126, drawer.tsx:118, form.tsx:132, sheet.tsx:124
```

**Fixed:**

```
/* TODO: Extract to named constant */ 115
```

### PATCH-FIX-006-1773867632456-7yf2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:142`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:142, breadcrumb.tsx:98, context-menu.tsx:233, dropdown-menu.tsx:247, navigation-menu.tsx:155, pagination.tsx:116
```

**Fixed:**

```
/* TODO: Extract to named constant */ 142
```

### PATCH-FIX-006-1773867632456-u0jc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:145`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:145, breadcrumb.tsx:101, card.tsx:84, chart.tsx:355, command.tsx:174, context-menu.tsx:236, dialog.tsx:132, drawer.tsx:124, dropdown-menu.tsx:250, form.tsx:158, menubar.tsx:259, navigation-menu.tsx:158, pagination.tsx:119, select.tsx:174, sheet.tsx:130, sidebar.tsx:701, table.tsx:107
```

**Fixed:**

```
/* TODO: Extract to named constant */ 145
```

### PATCH-FIX-006-1773867632456-csvp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:37`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:37, alert-dialog.tsx:85, alert.tsx:40, alert.tsx:56, avatar.tsx:14, avatar.tsx:43, breadcrumb.tsx:14, card.tsx:8, card.tsx:21, card.tsx:54, command.tsx:22, command.tsx:91, command.tsx:119, command.tsx:148, command.tsx:164, context-menu.tsx:86, context-menu.tsx:226, dialog.tsx:39, dialog.tsx:96, drawer.tsx:38, drawer.tsx:78, dropdown-menu.tsx:194, dropdown-menu.tsx:240, label.tsx:14, menubar.tsx:15, menubar.tsx:57, menubar.tsx:203, menubar.tsx:249, navigation-menu.tsx:38, navigation-menu.tsx:130, resizable.tsx:15, sheet.tsx:37, table.tsx:45, table.tsx:58, table.tsx:71, table.tsx:84, tabs.tsx:27, tabs.tsx:43, textarea.tsx:8
```

**Fixed:**

```
/* TODO: Extract to named constant */ 119
```

### PATCH-FIX-006-1773867632456-m8pp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:40`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:40, alert-dialog.tsx:88, alert.tsx:43, avatar.tsx:17, command.tsx:122, command.tsx:151, context-menu.tsx:89, context-menu.tsx:200, dialog.tsx:99, dropdown-menu.tsx:168, menubar.tsx:177, navigation-menu.tsx:41, navigation-menu.tsx:95, navigation-menu.tsx:133, pagination.tsx:61, sidebar.tsx:314, sidebar.tsx:433, sidebar.tsx:573, sidebar.tsx:648, table.tsx:87, tabs.tsx:30, tabs.tsx:46
```

**Fixed:**

```
/* TODO: Extract to named constant */ 122
```

### PATCH-FIX-006-1773867632456-uqfz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:63`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:63, alert-dialog.tsx:76, alert.tsx:47, sidebar.tsx:437, sidebar.tsx:577
```

**Fixed:**

```
/* TODO: Extract to named constant */ 437
```

### PATCH-FIX-006-1773867632456-qoaa

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:75`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:75, alert.tsx:46, sidebar.tsx:436, sidebar.tsx:576
```

**Fixed:**

```
/* TODO: Extract to named constant */ 436
```

### PATCH-FIX-006-1773867632456-yhkl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:89`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:89, dialog.tsx:100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632456-ddy7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:90`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:90, dialog.tsx:101, drawer.tsx:93, sheet.tsx:99
```

**Fixed:**

```
/* TODO: Extract to named constant */ 101
```

### PATCH-FIX-006-1773867632456-ukfw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:102`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:102, dialog.tsx:113, drawer.tsx:105, sheet.tsx:111
```

**Fixed:**

```
/* TODO: Extract to named constant */ 102
```

### PATCH-FIX-006-1773867632456-9ssw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:140`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:140, card.tsx:79, command.tsx:169, context-menu.tsx:231, dialog.tsx:127, drawer.tsx:119, dropdown-menu.tsx:245, menubar.tsx:254, sheet.tsx:125, sidebar.tsx:696, table.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 140
```

### PATCH-FIX-006-1773867632456-0gi0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:145`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:145, command.tsx:174, context-menu.tsx:236, dialog.tsx:132, drawer.tsx:124, dropdown-menu.tsx:250, menubar.tsx:259, navigation-menu.tsx:158, select.tsx:174, sidebar.tsx:701
```

**Fixed:**

```
/* TODO: Extract to named constant */ 145
```

### PATCH-FIX-006-1773867632456-x360

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert-dialog.tsx:140`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert-dialog.tsx:140, command.tsx:169, context-menu.tsx:231, dialog.tsx:127, drawer.tsx:119, dropdown-menu.tsx:245, menubar.tsx:254, sidebar.tsx:696
```

**Fixed:**

```
/* TODO: Extract to named constant */ 140
```

### PATCH-FIX-006-1773867632456-tmrt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx:5`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert.tsx:5, badge.tsx:6, button.tsx:6, sidebar.tsx:475, toast.tsx:26, toggle.tsx:8
```

**Fixed:**

```
/* TODO: Extract to named constant */ 475
```

### PATCH-FIX-006-1773867632456-scza

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx:35`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert.tsx:35, card.tsx:16, card.tsx:29, card.tsx:39, card.tsx:49, card.tsx:62, card.tsx:72, dialog.tsx:81, dialog.tsx:91, drawer.tsx:73, drawer.tsx:86, input-otp.tsx:27, sheet.tsx:82, sheet.tsx:92, sidebar.tsx:333, sidebar.tsx:344, sidebar.tsx:369, sidebar.tsx:383
```

**Fixed:**

```
/* TODO: Extract to named constant */ 333
```

### PATCH-FIX-006-1773867632456-un9y

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx:5`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert.tsx:5, sidebar.tsx:475, toast.tsx:26, toggle.tsx:8
```

**Fixed:**

```
/* TODO: Extract to named constant */ 475
```

### PATCH-FIX-006-1773867632456-j9x3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx:44`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert.tsx:44, command.tsx:152, sidebar.tsx:434, sidebar.tsx:574, sidebar.tsx:649, table.tsx:88
```

**Fixed:**

```
/* TODO: Extract to named constant */ 152
```

### PATCH-FIX-006-1773867632456-rm7b

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\alert.tsx:40`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
alert.tsx:40, command.tsx:148, table.tsx:84
```

**Fixed:**

```
/* TODO: Extract to named constant */ 148
```

### PATCH-FIX-006-1773867632456-eu9i

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\badge.tsx:41`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
badge.tsx:41, button.tsx:54, calendar.tsx:208, toggle.tsx:42
```

**Fixed:**

```
/* TODO: Extract to named constant */ 208
```

### PATCH-FIX-006-1773867632456-7fsr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:21`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:21, sidebar.tsx:462
```

**Fixed:**

```
/* TODO: Extract to named constant */ 462
```

### PATCH-FIX-006-1773867632456-26hy

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:40`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:40, button.tsx:47, sidebar.tsx:556, sidebar.tsx:679
```

**Fixed:**

```
/* TODO: Extract to named constant */ 556
```

### PATCH-FIX-006-1773867632456-2rwm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:67`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:67, sidebar.tsx:656
```

**Fixed:**

```
/* TODO: Extract to named constant */ 656
```

### PATCH-FIX-006-1773867632456-6h0l

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:83`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:83, command.tsx:158, context-menu.tsx:220, dropdown-menu.tsx:188, menubar.tsx:197, pagination.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 158
```

### PATCH-FIX-006-1773867632456-23ux

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:15`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:15, card.tsx:9, card.tsx:22, card.tsx:55, drawer.tsx:79, sidebar.tsx:376, table.tsx:46, table.tsx:59, table.tsx:72
```

**Fixed:**

```
/* TODO: Extract to named constant */ 376
```

### PATCH-FIX-006-1773867632456-5356

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:80`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:80, command.tsx:155, context-menu.tsx:217, dropdown-menu.tsx:185, menubar.tsx:194
```

**Fixed:**

```
/* TODO: Extract to named constant */ 155
```

### PATCH-FIX-006-1773867632456-ibqs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:97`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:97, pagination.tsx:115
```

**Fixed:**

```
/* TODO: Extract to named constant */ 115
```

### PATCH-FIX-006-1773867632456-1jd4

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\breadcrumb.tsx:100`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
breadcrumb.tsx:100, card.tsx:83, pagination.tsx:118
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632456-rmh4

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\button.tsx:29`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
button.tsx:29, sidebar.tsx:489, toggle.tsx:22
```

**Fixed:**

```
/* TODO: Extract to named constant */ 489
```

### PATCH-FIX-006-1773867632456-fyty

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\button.tsx:30`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
button.tsx:30, sidebar.tsx:490, toggle.tsx:23
```

**Fixed:**

```
/* TODO: Extract to named constant */ 490
```

### PATCH-FIX-006-1773867632456-2hmz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\button.tsx:55`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
button.tsx:55, calendar.tsx:209, toggle.tsx:43
```

**Fixed:**

```
/* TODO: Extract to named constant */ 209
```

### PATCH-FIX-006-1773867632456-bf12

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\button.tsx:29`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
button.tsx:29, sidebar.tsx:489, toggle.tsx:22
```

**Fixed:**

```
/* TODO: Extract to named constant */ 489
```

### PATCH-FIX-006-1773867632456-r0ik

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\calendar.tsx:173`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
calendar.tsx:173, chart.tsx:44, context-menu.tsx:54, context-menu.tsx:135, dropdown-menu.tsx:92, dropdown-menu.tsx:208, menubar.tsx:112, menubar.tsx:217, toggle-group.tsx:41
```

**Fixed:**

```
/* TODO: Extract to named constant */ 173
```

### PATCH-FIX-006-1773867632456-twpm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\calendar.tsx:170`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
calendar.tsx:170, context-menu.tsx:51, context-menu.tsx:132, dropdown-menu.tsx:89, menubar.tsx:109
```

**Fixed:**

```
/* TODO: Extract to named constant */ 170
```

### PATCH-FIX-006-1773867632456-rt99

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\card.tsx:11`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
card.tsx:11, card.tsx:24, card.tsx:57, drawer.tsx:81, sidebar.tsx:378
```

**Fixed:**

```
/* TODO: Extract to named constant */ 378
```

### PATCH-FIX-006-1773867632456-1whb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\card.tsx:35`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
card.tsx:35, card.tsx:45, card.tsx:68, dialog.tsx:87, input-otp.tsx:23, sheet.tsx:88, sidebar.tsx:329, sidebar.tsx:340, sidebar.tsx:365
```

**Fixed:**

```
/* TODO: Extract to named constant */ 329
```

### PATCH-FIX-006-1773867632456-o3fx

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\card.tsx:77`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
card.tsx:77, dialog.tsx:125, drawer.tsx:117, sheet.tsx:123, table.tsx:100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-ioo7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\card.tsx:77`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
card.tsx:77, dialog.tsx:125, drawer.tsx:117, sheet.tsx:123, table.tsx:100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-x49v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:144`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:144, chart.tsx:280
```

**Fixed:**

```
/* TODO: Extract to named constant */ 144
```

### PATCH-FIX-006-1773867632456-3edm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:145`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:145, carousel.tsx:164
```

**Fixed:**

```
/* TODO: Extract to named constant */ 145
```

### PATCH-FIX-006-1773867632456-ue7n

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:151`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:151, sidebar.tsx:635, table.tsx:17
```

**Fixed:**

```
/* TODO: Extract to named constant */ 151
```

### PATCH-FIX-006-1773867632456-bvb8

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:171, carousel.tsx:201, hover-card.tsx:19, menubar.tsx:64, scroll-area.tsx:28
```

**Fixed:**

```
/* TODO: Extract to named constant */ 171
```

### PATCH-FIX-006-1773867632456-90pt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:175`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:175, carousel.tsx:205
```

**Fixed:**

```
/* TODO: Extract to named constant */ 175
```

### PATCH-FIX-006-1773867632456-7oc1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:180`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:180, carousel.tsx:210
```

**Fixed:**

```
/* TODO: Extract to named constant */ 180
```

### PATCH-FIX-006-1773867632456-lieu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:185`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:185, carousel.tsx:215
```

**Fixed:**

```
/* TODO: Extract to named constant */ 185
```

### PATCH-FIX-006-1773867632456-ivug

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:235`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:235, toast.tsx:121
```

**Fixed:**

```
/* TODO: Extract to named constant */ 235
```

### PATCH-FIX-006-1773867632456-b2x2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:167`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:167, menubar.tsx:60
```

**Fixed:**

```
/* TODO: Extract to named constant */ 167
```

### PATCH-FIX-006-1773867632456-g8w6

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:171, carousel.tsx:201
```

**Fixed:**

```
/* TODO: Extract to named constant */ 171
```

### PATCH-FIX-006-1773867632456-7bch

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:175`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:175, carousel.tsx:205
```

**Fixed:**

```
/* TODO: Extract to named constant */ 175
```

### PATCH-FIX-006-1773867632456-u1hf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:180`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:180, carousel.tsx:210
```

**Fixed:**

```
/* TODO: Extract to named constant */ 180
```

### PATCH-FIX-006-1773867632456-q126

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:171, carousel.tsx:201
```

**Fixed:**

```
/* TODO: Extract to named constant */ 171
```

### PATCH-FIX-006-1773867632456-z17v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\carousel.tsx:175`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
carousel.tsx:175, carousel.tsx:205
```

**Fixed:**

```
/* TODO: Extract to named constant */ 175
```

### PATCH-FIX-006-1773867632456-cty2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\chart.tsx:123`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
chart.tsx:123, chart.tsx:167
```

**Fixed:**

```
/* TODO: Extract to named constant */ 123
```

### PATCH-FIX-006-1773867632456-xrpj

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\collapsible.tsx:16`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
collapsible.tsx:16, collapsible.tsx:27, context-menu.tsx:50, dropdown-menu.tsx:37, dropdown-menu.tsx:125
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-f3l0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:15`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:15, pagination.tsx:67, pagination.tsx:84, sidebar.tsx:320, sidebar.tsx:356
```

**Fixed:**

```
/* TODO: Extract to named constant */ 320
```

### PATCH-FIX-006-1773867632456-4whn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:29`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:29, sidebar.tsx:151
```

**Fixed:**

```
/* TODO: Extract to named constant */ 151
```

### PATCH-FIX-006-1773867632456-bb2a

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:76`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:76, navigation-menu.tsx:115
```

**Fixed:**

```
/* TODO: Extract to named constant */ 115
```

### PATCH-FIX-006-1773867632456-lccc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:81`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:81, navigation-menu.tsx:120, sidebar.tsx:252
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632456-tvl1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:127`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:127, context-menu.tsx:205, dropdown-menu.tsx:173, menubar.tsx:182, select.tsx:123
```

**Fixed:**

```
/* TODO: Extract to named constant */ 127
```

### PATCH-FIX-006-1773867632456-j6xk

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:160`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:160, context-menu.tsx:222, dropdown-menu.tsx:190, menubar.tsx:199
```

**Fixed:**

```
/* TODO: Extract to named constant */ 160
```

### PATCH-FIX-006-1773867632456-3mv5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:165, context-menu.tsx:227, dropdown-menu.tsx:195, menubar.tsx:204
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-vybi

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:74`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:74, navigation-menu.tsx:113
```

**Fixed:**

```
/* TODO: Extract to named constant */ 113
```

### PATCH-FIX-006-1773867632456-qwe7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:75`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:75, navigation-menu.tsx:114
```

**Fixed:**

```
/* TODO: Extract to named constant */ 114
```

### PATCH-FIX-006-1773867632456-2lpg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:93`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:93, dropdown-menu.tsx:196, menubar.tsx:17, menubar.tsx:205, resizable.tsx:17
```

**Fixed:**

```
/* TODO: Extract to named constant */ 196
```

### PATCH-FIX-006-1773867632456-fn2p

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:123`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:123, context-menu.tsx:201, dropdown-menu.tsx:169, menubar.tsx:178
```

**Fixed:**

```
/* TODO: Extract to named constant */ 123
```

### PATCH-FIX-006-1773867632456-o2l0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:136`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:136, radio-group.tsx:16
```

**Fixed:**

```
/* TODO: Extract to named constant */ 136
```

### PATCH-FIX-006-1773867632456-ovdd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:154`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:154, context-menu.tsx:216, dropdown-menu.tsx:184, menubar.tsx:193
```

**Fixed:**

```
/* TODO: Extract to named constant */ 154
```

### PATCH-FIX-006-1773867632456-4kcf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:156`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:156, context-menu.tsx:218, dropdown-menu.tsx:186, menubar.tsx:195
```

**Fixed:**

```
/* TODO: Extract to named constant */ 156
```

### PATCH-FIX-006-1773867632456-z5ia

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:160`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:160, context-menu.tsx:222, dropdown-menu.tsx:190, menubar.tsx:199
```

**Fixed:**

```
/* TODO: Extract to named constant */ 160
```

### PATCH-FIX-006-1773867632456-ilk8

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:165, context-menu.tsx:227
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-jrmr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:153`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:153, context-menu.tsx:215, dropdown-menu.tsx:183, menubar.tsx:192
```

**Fixed:**

```
/* TODO: Extract to named constant */ 153
```

### PATCH-FIX-006-1773867632456-03uh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:155`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:155, context-menu.tsx:217, dropdown-menu.tsx:185, menubar.tsx:194
```

**Fixed:**

```
/* TODO: Extract to named constant */ 155
```

### PATCH-FIX-006-1773867632456-ds0d

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:160`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:160, context-menu.tsx:222
```

**Fixed:**

```
/* TODO: Extract to named constant */ 160
```

### PATCH-FIX-006-1773867632456-3tvg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:165, context-menu.tsx:227, dropdown-menu.tsx:241, menubar.tsx:250
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-wmfk

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\command.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
command.tsx:171, navigation-menu.tsx:155
```

**Fixed:**

```
/* TODO: Extract to named constant */ 171
```

### PATCH-FIX-006-1773867632456-i0gj

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:36`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:36, dropdown-menu.tsx:201, menubar.tsx:210
```

**Fixed:**

```
/* TODO: Extract to named constant */ 201
```

### PATCH-FIX-006-1773867632456-6hqm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:43`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:43, dropdown-menu.tsx:118, menubar.tsx:41
```

**Fixed:**

```
/* TODO: Extract to named constant */ 118
```

### PATCH-FIX-006-1773867632456-gc7b

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:56`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:56, dropdown-menu.tsx:210, menubar.tsx:219
```

**Fixed:**

```
/* TODO: Extract to named constant */ 210
```

### PATCH-FIX-006-1773867632456-pl1o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:66`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:66, context-menu.tsx:196, dropdown-menu.tsx:164, dropdown-menu.tsx:220, menubar.tsx:173, menubar.tsx:229
```

**Fixed:**

```
/* TODO: Extract to named constant */ 196
```

### PATCH-FIX-006-1773867632456-8c5o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:70`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:70, dropdown-menu.tsx:224, menubar.tsx:233
```

**Fixed:**

```
/* TODO: Extract to named constant */ 224
```

### PATCH-FIX-006-1773867632456-rt7v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:78`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:78, dropdown-menu.tsx:232, menubar.tsx:241
```

**Fixed:**

```
/* TODO: Extract to named constant */ 232
```

### PATCH-FIX-006-1773867632456-nwpw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:112`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:112, dropdown-menu.tsx:69, menubar.tsx:89, select.tsx:51, sheet.tsx:45
```

**Fixed:**

```
/* TODO: Extract to named constant */ 112
```

### PATCH-FIX-006-1773867632456-1peu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:115`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:115, dropdown-menu.tsx:72, menubar.tsx:92
```

**Fixed:**

```
/* TODO: Extract to named constant */ 115
```

### PATCH-FIX-006-1773867632456-7yfh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:125`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:125, dropdown-menu.tsx:82, menubar.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-4zvz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:137`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:137, dropdown-menu.tsx:94, menubar.tsx:114
```

**Fixed:**

```
/* TODO: Extract to named constant */ 137
```

### PATCH-FIX-006-1773867632456-nfp5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:145`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:145, dropdown-menu.tsx:102, menubar.tsx:122
```

**Fixed:**

```
/* TODO: Extract to named constant */ 145
```

### PATCH-FIX-006-1773867632456-s5iz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:162`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:162, dropdown-menu.tsx:130, menubar.tsx:139
```

**Fixed:**

```
/* TODO: Extract to named constant */ 162
```

### PATCH-FIX-006-1773867632456-te6f

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:171, dropdown-menu.tsx:139
```

**Fixed:**

```
/* TODO: Extract to named constant */ 171
```

### PATCH-FIX-006-1773867632456-1a83

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:186`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:186, dropdown-menu.tsx:154, menubar.tsx:163
```

**Fixed:**

```
/* TODO: Extract to named constant */ 186
```

### PATCH-FIX-006-1773867632456-4gb1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:214`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:214, dropdown-menu.tsx:182, menubar.tsx:191
```

**Fixed:**

```
/* TODO: Extract to named constant */ 214
```

### PATCH-FIX-006-1773867632456-12xa

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:54`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:54, dropdown-menu.tsx:208, menubar.tsx:217
```

**Fixed:**

```
/* TODO: Extract to named constant */ 208
```

### PATCH-FIX-006-1773867632456-m8ui

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:55`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:55, dropdown-menu.tsx:209, menubar.tsx:218
```

**Fixed:**

```
/* TODO: Extract to named constant */ 209
```

### PATCH-FIX-006-1773867632456-cw2m

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:66`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:66, dropdown-menu.tsx:220, menubar.tsx:229
```

**Fixed:**

```
/* TODO: Extract to named constant */ 220
```

### PATCH-FIX-006-1773867632456-qw4a

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:111`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:111, dropdown-menu.tsx:68, menubar.tsx:88
```

**Fixed:**

```
/* TODO: Extract to named constant */ 111
```

### PATCH-FIX-006-1773867632456-wcqb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:125`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:125, dropdown-menu.tsx:82, menubar.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-66pa

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:130`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:130, dialog.tsx:42, drawer.tsx:41, dropdown-menu.tsx:87, menubar.tsx:107, sheet.tsx:40
```

**Fixed:**

```
/* TODO: Extract to named constant */ 130
```

### PATCH-FIX-006-1773867632456-1vh1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:184`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:184, dropdown-menu.tsx:152, menubar.tsx:161
```

**Fixed:**

```
/* TODO: Extract to named constant */ 184
```

### PATCH-FIX-006-1773867632456-0h5q

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:185`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:185, dropdown-menu.tsx:153, menubar.tsx:162
```

**Fixed:**

```
/* TODO: Extract to named constant */ 185
```

### PATCH-FIX-006-1773867632456-yb8o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:196`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:196, dropdown-menu.tsx:164, menubar.tsx:173
```

**Fixed:**

```
/* TODO: Extract to named constant */ 196
```

### PATCH-FIX-006-1773867632456-hhk5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:125`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:125, dropdown-menu.tsx:82, menubar.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-bwl3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:196`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:196, dropdown-menu.tsx:164, menubar.tsx:173
```

**Fixed:**

```
/* TODO: Extract to named constant */ 196
```

### PATCH-FIX-006-1773867632456-36yv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:213`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:213, dropdown-menu.tsx:181, menubar.tsx:190
```

**Fixed:**

```
/* TODO: Extract to named constant */ 213
```

### PATCH-FIX-006-1773867632456-n1g7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:234`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:234, dropdown-menu.tsx:248, menubar.tsx:257, sidebar.tsx:699
```

**Fixed:**

```
/* TODO: Extract to named constant */ 234
```

### PATCH-FIX-006-1773867632456-zy0k

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\context-menu.tsx:235`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
context-menu.tsx:235, dropdown-menu.tsx:249, menubar.tsx:258, sidebar.tsx:700
```

**Fixed:**

```
/* TODO: Extract to named constant */ 235
```

### PATCH-FIX-006-1773867632456-us7v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dialog.tsx:126`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dialog.tsx:126, drawer.tsx:118, sheet.tsx:124, table.tsx:101
```

**Fixed:**

```
/* TODO: Extract to named constant */ 126
```

### PATCH-FIX-006-1773867632456-cmwb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dialog.tsx:130`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dialog.tsx:130, drawer.tsx:122, select.tsx:172
```

**Fixed:**

```
/* TODO: Extract to named constant */ 130
```

### PATCH-FIX-006-1773867632456-lnds

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\drawer.tsx:58`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
drawer.tsx:58, sidebar.tsx:293, sidebar.tsx:588
```

**Fixed:**

```
/* TODO: Extract to named constant */ 293
```

### PATCH-FIX-006-1773867632456-t9bo

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\drawer.tsx:60`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
drawer.tsx:60, sidebar.tsx:296, sidebar.tsx:591
```

**Fixed:**

```
/* TODO: Extract to named constant */ 296
```

### PATCH-FIX-006-1773867632456-6dpq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\drawer.tsx:105`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
drawer.tsx:105, sheet.tsx:111
```

**Fixed:**

```
/* TODO: Extract to named constant */ 105
```

### PATCH-FIX-006-1773867632456-pw1q

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dropdown-menu.tsx:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dropdown-menu.tsx:165, menubar.tsx:174
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-ysv1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dropdown-menu.tsx:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dropdown-menu.tsx:165, menubar.tsx:174
```

**Fixed:**

```
/* TODO: Extract to named constant */ 165
```

### PATCH-FIX-006-1773867632456-p5x8

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dropdown-menu.tsx:197`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dropdown-menu.tsx:197, menubar.tsx:206
```

**Fixed:**

```
/* TODO: Extract to named constant */ 197
```

### PATCH-FIX-006-1773867632456-3809

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dropdown-menu.tsx:190`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
dropdown-menu.tsx:190, menubar.tsx:199
```

**Fixed:**

```
/* TODO: Extract to named constant */ 190
```

### PATCH-FIX-006-1773867632456-j1o2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\form.tsx:158`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
form.tsx:158, sheet.tsx:130, table.tsx:107
```

**Fixed:**

```
/* TODO: Extract to named constant */ 158
```

### PATCH-FIX-006-1773867632456-beyt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\input.tsx:12`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
input.tsx:12, navigation-menu.tsx:93, sidebar.tsx:298, sidebar.tsx:312, sidebar.tsx:408, sidebar.tsx:431, sidebar.tsx:593, sidebar.tsx:646
```

**Fixed:**

```
/* TODO: Extract to named constant */ 298
```

### PATCH-FIX-006-1773867632456-xztp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\input.tsx:11`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
input.tsx:11, sidebar.tsx:297, sidebar.tsx:429, sidebar.tsx:592
```

**Fixed:**

```
/* TODO: Extract to named constant */ 297
```

### PATCH-FIX-006-1773867632456-55yd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\navigation-menu.tsx:56`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
navigation-menu.tsx:56, sidebar.tsx:471
```

**Fixed:**

```
/* TODO: Extract to named constant */ 471
```

### PATCH-FIX-006-1773867632456-vxk5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\navigation-menu.tsx:91`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
navigation-menu.tsx:91, sidebar.tsx:310
```

**Fixed:**

```
/* TODO: Extract to named constant */ 310
```

### PATCH-FIX-006-1773867632456-9s6c

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\navigation-menu.tsx:91`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
navigation-menu.tsx:91, sidebar.tsx:310
```

**Fixed:**

```
/* TODO: Extract to named constant */ 310
```

### PATCH-FIX-006-1773867632456-dezh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\pagination.tsx:66`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
pagination.tsx:66, pagination.tsx:83, sidebar.tsx:319, sidebar.tsx:355
```

**Fixed:**

```
/* TODO: Extract to named constant */ 319
```

### PATCH-FIX-006-1773867632456-p4xv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\pagination.tsx:62`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
pagination.tsx:62, sidebar.tsx:315
```

**Fixed:**

```
/* TODO: Extract to named constant */ 315
```

### PATCH-FIX-006-1773867632456-w85m

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\select.tsx:145`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
select.tsx:145, select.tsx:163
```

**Fixed:**

```
/* TODO: Extract to named constant */ 145
```

### PATCH-FIX-006-1773867632456-kpug

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sheet.tsx:125`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sheet.tsx:125, table.tsx:102
```

**Fixed:**

```
/* TODO: Extract to named constant */ 125
```

### PATCH-FIX-006-1773867632456-5w65

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:143`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:143, sidebar.tsx:174
```

**Fixed:**

```
/* TODO: Extract to named constant */ 143
```

### PATCH-FIX-006-1773867632456-oyv2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:156`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:156, sidebar.tsx:501
```

**Fixed:**

```
/* TODO: Extract to named constant */ 156
```

### PATCH-FIX-006-1773867632456-t1ob

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:327`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:327, sidebar.tsx:338, sidebar.tsx:349, sidebar.tsx:363, sidebar.tsx:388, sidebar.tsx:446, sidebar.tsx:457, sidebar.tsx:468, sidebar.tsx:661
```

**Fixed:**

```
/* TODO: Extract to named constant */ 327
```

### PATCH-FIX-006-1773867632456-ejwt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:334`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:334, sidebar.tsx:345, sidebar.tsx:370, sidebar.tsx:384
```

**Fixed:**

```
/* TODO: Extract to named constant */ 334
```

### PATCH-FIX-006-1773867632456-33rl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:335`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:335, sidebar.tsx:346, sidebar.tsx:385
```

**Fixed:**

```
/* TODO: Extract to named constant */ 335
```

### PATCH-FIX-006-1773867632456-qglu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:340`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:340, sidebar.tsx:351
```

**Fixed:**

```
/* TODO: Extract to named constant */ 340
```

### PATCH-FIX-006-1773867632456-6k1j

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:372`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:372, sidebar.tsx:584
```

**Fixed:**

```
/* TODO: Extract to named constant */ 372
```

### PATCH-FIX-006-1773867632456-r2hf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:393`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:393, sidebar.tsx:414, sidebar.tsx:545, sidebar.tsx:599
```

**Fixed:**

```
/* TODO: Extract to named constant */ 393
```

### PATCH-FIX-006-1773867632456-snbt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:395`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:395, sidebar.tsx:416
```

**Fixed:**

```
/* TODO: Extract to named constant */ 395
```

### PATCH-FIX-006-1773867632456-2hbp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:400`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:400, sidebar.tsx:421
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632456-8xs6

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:405`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:405, sidebar.tsx:643
```

**Fixed:**

```
/* TODO: Extract to named constant */ 405
```

### PATCH-FIX-006-1773867632456-2yng

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:425`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:425, sidebar.tsx:560
```

**Fixed:**

```
/* TODO: Extract to named constant */ 425
```

### PATCH-FIX-006-1773867632456-kg5c

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:432`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:432, sidebar.tsx:594, sidebar.tsx:647, sidebar.tsx:693
```

**Fixed:**

```
/* TODO: Extract to named constant */ 432
```

### PATCH-FIX-006-1773867632456-rusk

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:442`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:442, sidebar.tsx:582
```

**Fixed:**

```
/* TODO: Extract to named constant */ 442
```

### PATCH-FIX-006-1773867632456-hgcs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:451`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:451, sidebar.tsx:637
```

**Fixed:**

```
/* TODO: Extract to named constant */ 451
```

### PATCH-FIX-006-1773867632456-o2zl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:466`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:466, sidebar.tsx:659
```

**Fixed:**

```
/* TODO: Extract to named constant */ 466
```

### PATCH-FIX-006-1773867632456-x8o2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:480`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:480, toggle.tsx:13
```

**Fixed:**

```
/* TODO: Extract to named constant */ 480
```

### PATCH-FIX-006-1773867632456-cdzr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:485`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:485, toggle.tsx:18
```

**Fixed:**

```
/* TODO: Extract to named constant */ 485
```

### PATCH-FIX-006-1773867632456-v9i7

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:636`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:636, table.tsx:18
```

**Fixed:**

```
/* TODO: Extract to named constant */ 636
```

### PATCH-FIX-006-1773867632456-pp95

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:293`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:293, sidebar.tsx:588
```

**Fixed:**

```
/* TODO: Extract to named constant */ 293
```

### PATCH-FIX-006-1773867632456-ermb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:295`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:295, sidebar.tsx:590
```

**Fixed:**

```
/* TODO: Extract to named constant */ 295
```

### PATCH-FIX-006-1773867632456-blri

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:327`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:327, sidebar.tsx:338, sidebar.tsx:363, sidebar.tsx:446, sidebar.tsx:457
```

**Fixed:**

```
/* TODO: Extract to named constant */ 327
```

### PATCH-FIX-006-1773867632456-8k15

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:330`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:330, sidebar.tsx:341, sidebar.tsx:366, sidebar.tsx:380
```

**Fixed:**

```
/* TODO: Extract to named constant */ 330
```

### PATCH-FIX-006-1773867632456-nwif

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:335`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:335, sidebar.tsx:346, sidebar.tsx:385
```

**Fixed:**

```
/* TODO: Extract to named constant */ 335
```

### PATCH-FIX-006-1773867632456-gd1a

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:348`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:348, sidebar.tsx:387
```

**Fixed:**

```
/* TODO: Extract to named constant */ 348
```

### PATCH-FIX-006-1773867632456-kpkf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:391`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:391, sidebar.tsx:412
```

**Fixed:**

```
/* TODO: Extract to named constant */ 391
```

### PATCH-FIX-006-1773867632456-rkzy

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:395`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:395, sidebar.tsx:416
```

**Fixed:**

```
/* TODO: Extract to named constant */ 395
```

### PATCH-FIX-006-1773867632456-8jxn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:405`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:405, sidebar.tsx:643
```

**Fixed:**

```
/* TODO: Extract to named constant */ 405
```

### PATCH-FIX-006-1773867632456-8yls

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:410`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:410, sidebar.tsx:595
```

**Fixed:**

```
/* TODO: Extract to named constant */ 410
```

### PATCH-FIX-006-1773867632456-yl8q

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:422`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:422, sidebar.tsx:557
```

**Fixed:**

```
/* TODO: Extract to named constant */ 422
```

### PATCH-FIX-006-1773867632456-n7nd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:438`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:438, sidebar.tsx:578
```

**Fixed:**

```
/* TODO: Extract to named constant */ 438
```

### PATCH-FIX-006-1773867632456-vulh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:466`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:466, sidebar.tsx:659
```

**Fixed:**

```
/* TODO: Extract to named constant */ 466
```

### PATCH-FIX-006-1773867632456-vs46

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:476`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:476, toggle.tsx:9
```

**Fixed:**

```
/* TODO: Extract to named constant */ 476
```

### PATCH-FIX-006-1773867632456-qwxx

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:480`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:480, toggle.tsx:13
```

**Fixed:**

```
/* TODO: Extract to named constant */ 480
```

### PATCH-FIX-006-1773867632456-r1if

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:485`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:485, toggle.tsx:18
```

**Fixed:**

```
/* TODO: Extract to named constant */ 485
```

### PATCH-FIX-006-1773867632456-vr21

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:330`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:330, sidebar.tsx:380
```

**Fixed:**

```
/* TODO: Extract to named constant */ 330
```

### PATCH-FIX-006-1773867632456-xhm0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:343`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:343, sidebar.tsx:382
```

**Fixed:**

```
/* TODO: Extract to named constant */ 343
```

### PATCH-FIX-006-1773867632456-bd7i

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:391`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:391, sidebar.tsx:412
```

**Fixed:**

```
/* TODO: Extract to named constant */ 391
```

### PATCH-FIX-006-1773867632456-kszl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:395`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:395, sidebar.tsx:417
```

**Fixed:**

```
/* TODO: Extract to named constant */ 395
```

### PATCH-FIX-006-1773867632456-3up0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:433`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:433, sidebar.tsx:573
```

**Fixed:**

```
/* TODO: Extract to named constant */ 433
```

### PATCH-FIX-006-1773867632456-r8m3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:475`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:475, toggle.tsx:8
```

**Fixed:**

```
/* TODO: Extract to named constant */ 475
```

### PATCH-FIX-006-1773867632456-7v54

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:480`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
sidebar.tsx:480, toggle.tsx:13
```

**Fixed:**

```
/* TODO: Extract to named constant */ 480
```

### PATCH-FIX-006-1773867632457-fc3v

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:62`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const socketInstance = io('/?XTransformPort=3003', {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 3003
```

### PATCH-FIX-006-1773867632457-kzk8

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:67`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
reconnectionDelay: 1000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000
```

### PATCH-FIX-006-1773867632457-cdpp

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:138`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className={`text-sm px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-gmhj

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<p className="text-gray-500 text-center">No messages yet</p>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-f1z2

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:178`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
? 'text-blue-600 italic'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 600
```

### PATCH-FIX-006-1773867632457-kzl5

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:184`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
? 'text-blue-500 italic'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-l73f

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:185`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
: 'text-gray-900'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 900
```

### PATCH-FIX-006-1773867632457-dko8

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:190`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className="text-xs text-gray-500">
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-eswn

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:62`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const socketInstance = io('/?XTransformPort=3003', {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 3003
```

### PATCH-FIX-006-1773867632457-e2e7

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:67`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
reconnectionDelay: 1000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000
```

### PATCH-FIX-006-1773867632457-bhv7

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:138`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className={`text-sm px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-0thb

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:171`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<p className="text-gray-500 text-center">No messages yet</p>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-74wn

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:178`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
? 'text-blue-600 italic'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 600
```

### PATCH-FIX-006-1773867632457-r8no

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:184`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
? 'text-blue-500 italic'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-jpa0

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:185`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
: 'text-gray-900'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 900
```

### PATCH-FIX-006-1773867632457-hr5q

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\frontend.tsx:190`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className="text-xs text-gray-500">
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-cx74

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:12`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
pingTimeout: 60000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 60000
```

### PATCH-FIX-006-1773867632457-y0ng

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:122`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const PORT = 3003
```

**Fixed:**

```
/* TODO: Extract to named constant */ 3003
```

### PATCH-FIX-006-1773867632457-33ls

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:148`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const id = 'test-id-12345'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 12345
```

### PATCH-FIX-006-1773867632457-o7rg

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:177`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const id = 'test-id-12345'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 12345
```

### PATCH-FIX-006-1773867632457-0dc2

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:12`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
pingTimeout: 60000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 60000
```

### PATCH-FIX-006-1773867632457-7r32

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:122`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const PORT = 3003
```

**Fixed:**

```
/* TODO: Extract to named constant */ 3003
```

### PATCH-FIX-006-1773867632457-a13m

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:148`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const id = 'test-id-12345'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 12345
```

### PATCH-FIX-006-1773867632457-ozbd

- **File:** `C:\Users\User\Desktop\OTM Agent\examples\websocket\server.ts:177`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const id = 'test-id-12345'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 12345
```

### PATCH-FIX-006-1773867632457-mexu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:60`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
CURRENT SCORE: ${opportunity.score}/100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-ovpz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:70`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
7. confidenceScore (0-100): how confident are you in this analysis
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-aiby

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:80`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-src6

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:131`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
Keep responses under 150 words. Use bullet points when listing steps.`
```

**Fixed:**

```
/* TODO: Extract to named constant */ 150
```

### PATCH-FIX-006-1773867632457-2rff

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:139`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 300,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-uzz9

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
- duration: minutes (15-120)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-b45j

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:176`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 400
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632457-8u26

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:227`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632457-5ya8

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:234`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, { status: 500 })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-h2ej

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:60`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
CURRENT SCORE: ${opportunity.score}/100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-gv0s

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:70`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
7. confidenceScore (0-100): how confident are you in this analysis
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-qavn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:80`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-at60

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:131`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
Keep responses under 150 words. Use bullet points when listing steps.`
```

**Fixed:**

```
/* TODO: Extract to named constant */ 150
```

### PATCH-FIX-006-1773867632457-8ryi

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:139`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 300,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-wh94

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:165`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
- duration: minutes (15-120)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-6217

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:176`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max_tokens: 400
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632457-3wmr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:227`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 400
```

### PATCH-FIX-006-1773867632457-2ysq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\api\ai\route.ts:234`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, { status: 500 })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-3r58

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:158`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ name: 'Hustler', minXP: 100, icon: '💪' },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-rr7o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:160`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ name: 'Operator', minXP: 1500, icon: '🎯' },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1500
```

### PATCH-FIX-006-1773867632457-oz9l

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:172`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ id: 'high_roller', name: 'High Roller', description: 'Reach $500 bankroll', icon: '💰', unlocked: false, progress: 0, target: 500 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-pcoo

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:175`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ id: 'mogul_status', name: 'Mogul Status', description: 'Reach Mogul level', icon: '🏆', unlocked: false, progress: 0, target: 15000 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-ye02

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:188`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'UPWORK', desc: 'AI product description writing — 50 items', amt: '$85', score: 92, scoreFactors: { timeToFirstDollar: 95, effort: 85, capital: 100, skill: 90, scalability: 75 }, riskLevel: 'Lo
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-gv7g

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:190`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'FIVERR', desc: 'Social media bio rewrites — surge in demand', amt: '$30/gig', score: 88, scoreFactors: { timeToFirstDollar: 90, effort: 90, capital: 100, skill: 85, scalability: 70 }, riskLeve
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-0vyx

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:195`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'SCALE AI', desc: 'RLHF feedback tasks — $12/hr equivalent', amt: '$50/day', score: 82, scoreFactors: { timeToFirstDollar: 90, effort: 85, capital: 100, skill: 90, scalability: 55 }, riskLevel:
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-fkuz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:209`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
['Scout: Upwork has 3 new AI writing gigs under $150 — Builder can fulfill in <10 min', 'warn'],
```

**Fixed:**

```
/* TODO: Extract to named constant */ 150
```

### PATCH-FIX-006-1773867632457-hdbj

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:214`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
['Scout: Clickworker batch opened — 200 annotation tasks @ $0.20 each = $40 available', 'warn'],
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-1kse

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:267`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
— <strong>$50–$500:</strong> Reinvest up to 20% into automation (Make.com plan, domain, Gumroad).<br>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-pjvc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:296`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 100,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-p246

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:300`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Builder transforms each post into an original 800-word blog article using AI.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 800
```

### PATCH-FIX-006-1773867632457-md5w

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:306`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At 50K monthly views, this yields $500–2K/month passively.'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-2ane

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:312`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 200,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-7jat

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:317`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Set pricing: Basic $25, Standard $60, Premium $120.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-8tk1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:328`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 500,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-oow1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:337`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At $500 in sales, reinvest in a paid Gumroad promo or ProductHunt launch.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-lj6b

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:343`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
minBankroll: 200,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-e7y5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:352`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Close at $200–300/month. Client perceives high value — you pay $29.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-tpjt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:360`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 5000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 5000
```

### PATCH-FIX-006-1773867632457-bney

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:367`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Charge $300–800 for a one-time build, or $300–500/month to maintain and improve.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-ghzl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:370`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At 5 retainer clients ($300/mo each), you have $1,500/mo in recurring revenue.'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-li2s

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:422`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
return { level: 1, name: 'Rookie', icon: '🌱', nextXP: 100 }
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-awzb

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:476`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$200-500 potential',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-6w4v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:487`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$75-300',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-88av

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:509`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$300-500/mo',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-64oz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:510`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
priority: bankroll >= 200 ? 70 : 40,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-zqsm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:525`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
let reservePct = 100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-t34x

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:530`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
reservePct = 100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-zq47

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:535`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
} else if (bankroll < 500) {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-r6xe

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:549`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
if (amount < 100) return ['Make.com Pro ($29/mo)', 'ChatGPT Plus ($20/mo)', 'Custom domain ($12/yr)']
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-76rs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:561`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * automationPct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-qeyy

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:566`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * learningPct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-rjrv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:571`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * reservePct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-s5ii

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:580`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
if (bankroll < 200) return ['gigbot', 'content', 'templates', 'automationsvc']
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-5lvh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:592`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
} else if (bankroll < 200) {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-3zgz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:598`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
allocations.push({ strategy: 'Automation Svc', hours: Math.round(baseHours * 0.35), expectedReturn: 120, risk: 'Medium', color: '#10b981' })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-wrf5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:738`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
unlocked = bankroll >= 500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-o62b

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:750`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
unlocked = prev.xp >= 15000
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-yx7e

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:967`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
setTimeout(() => addLog(l[0], l[1]), i * 600)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 600
```

### PATCH-FIX-006-1773867632457-ew3m

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:974`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const interval = setInterval(pushRadarItem, 5000 + Math.random() * 5000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 5000
```

### PATCH-FIX-006-1773867632457-ed83

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:985`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, 10000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 10000
```

### PATCH-FIX-006-1773867632457-0iet

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:998`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, 15000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-15un

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1043`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ max: 500, threshold: 50 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-agxs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1045`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ max: 10000, threshold: 2500 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 10000
```

### PATCH-FIX-006-1773867632457-qj8i

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1073`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="xp-fill" style={{ width: `${Math.min(100, (gameState.xp / levelInfo.nextXP) * 100)}%` }}></div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-sybs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1206`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<button className="btn-ghost" onClick={() => quickSet(100)}>$100</button>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-xnb0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1267`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div key={idx} className="portfolio-bar" style={{ width: `${(item.hours / hoursPerDay) * 100}%`, background: item.color }}>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-gi5x

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1291`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>📡</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 245
```

### PATCH-FIX-006-1773867632457-441y

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1299`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>💬</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 185
```

### PATCH-FIX-006-1773867632457-cfc5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1307`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>🛠️</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 139
```

### PATCH-FIX-006-1773867632457-4b5v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1315`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>📈</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 239
```

### PATCH-FIX-006-1773867632457-zg97

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1444`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const thresholds = [0, 50, 500, 2500]
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-52e3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1445`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const maxes = [50, 500, 2500, 10000]
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-ancn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1588`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="progress-fill" style={{ width: `${Math.min(100, ((ach.progress || 0) / ach.target) * 100)}%` }}></div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-x7zq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1685`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className="stat-value">{aiAnalysis.feasibilityScore}/100</span>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-mqtt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:158`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ name: 'Hustler', minXP: 100, icon: '💪' },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-ojhc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:160`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ name: 'Operator', minXP: 1500, icon: '🎯' },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1500
```

### PATCH-FIX-006-1773867632457-gdd5

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:172`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ id: 'high_roller', name: 'High Roller', description: 'Reach $500 bankroll', icon: '💰', unlocked: false, progress: 0, target: 500 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-38mc

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:175`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ id: 'mogul_status', name: 'Mogul Status', description: 'Reach Mogul level', icon: '🏆', unlocked: false, progress: 0, target: 15000 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-m807

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:188`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'UPWORK', desc: 'AI product description writing — 50 items', amt: '$85', score: 92, scoreFactors: { timeToFirstDollar: 95, effort: 85, capital: 100, skill: 90, scalability: 75 }, riskLevel: 'Lo
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-1zly

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:190`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'FIVERR', desc: 'Social media bio rewrites — surge in demand', amt: '$30/gig', score: 88, scoreFactors: { timeToFirstDollar: 90, effort: 90, capital: 100, skill: 85, scalability: 70 }, riskLeve
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-ug4d

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:195`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ src: 'SCALE AI', desc: 'RLHF feedback tasks — $12/hr equivalent', amt: '$50/day', score: 82, scoreFactors: { timeToFirstDollar: 90, effort: 85, capital: 100, skill: 90, scalability: 55 }, riskLevel:
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-n5aw

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:209`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
['Scout: Upwork has 3 new AI writing gigs under $150 — Builder can fulfill in <10 min', 'warn'],
```

**Fixed:**

```
/* TODO: Extract to named constant */ 150
```

### PATCH-FIX-006-1773867632457-003l

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:214`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
['Scout: Clickworker batch opened — 200 annotation tasks @ $0.20 each = $40 available', 'warn'],
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-n06e

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:267`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
— <strong>$50–$500:</strong> Reinvest up to 20% into automation (Make.com plan, domain, Gumroad).<br>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-673t

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:296`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 100,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-sy4x

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:300`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Builder transforms each post into an original 800-word blog article using AI.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 800
```

### PATCH-FIX-006-1773867632457-bezo

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:306`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At 50K monthly views, this yields $500–2K/month passively.'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-2h7o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:312`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 200,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-jl3c

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:317`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Set pricing: Basic $25, Standard $60, Premium $120.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-b2l0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:328`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 500,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-w823

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:337`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At $500 in sales, reinvest in a paid Gumroad promo or ProductHunt launch.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-d50o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:343`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
minBankroll: 200,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-8xxs

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:352`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Close at $200–300/month. Client perceives high value — you pay $29.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-h8tg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:360`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
maxBankroll: 5000,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 5000
```

### PATCH-FIX-006-1773867632457-vbvt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:367`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'Charge $300–800 for a one-time build, or $300–500/month to maintain and improve.',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-ru3v

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:370`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
'At 5 retainer clients ($300/mo each), you have $1,500/mo in recurring revenue.'
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-e3rd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:422`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
return { level: 1, name: 'Rookie', icon: '🌱', nextXP: 100 }
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-v2yx

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:476`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$200-500 potential',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-wwom

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:487`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$75-300',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-jnop

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:509`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
expectedEarnings: '$300-500/mo',
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-qgvt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:510`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
priority: bankroll >= 200 ? 70 : 40,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-4rcl

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:525`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
let reservePct = 100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-4oup

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:530`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
reservePct = 100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-e9a0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:535`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
} else if (bankroll < 500) {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-p47i

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:549`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
if (amount < 100) return ['Make.com Pro ($29/mo)', 'ChatGPT Plus ($20/mo)', 'Custom domain ($12/yr)']
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-meoq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:561`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * automationPct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-0otg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:566`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * learningPct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-9cqi

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:571`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
amount: Math.round(bankroll * reservePct / 100),
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-ddle

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:580`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
if (bankroll < 200) return ['gigbot', 'content', 'templates', 'automationsvc']
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-nfju

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:592`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
} else if (bankroll < 200) {
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-rct0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:598`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
allocations.push({ strategy: 'Automation Svc', hours: Math.round(baseHours * 0.35), expectedReturn: 120, risk: 'Medium', color: '#10b981' })
```

**Fixed:**

```
/* TODO: Extract to named constant */ 120
```

### PATCH-FIX-006-1773867632457-4ukh

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:738`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
unlocked = bankroll >= 500
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-gmyn

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:750`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
unlocked = prev.xp >= 15000
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-ik9p

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:967`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
setTimeout(() => addLog(l[0], l[1]), i * 600)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 600
```

### PATCH-FIX-006-1773867632457-krw3

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:974`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const interval = setInterval(pushRadarItem, 5000 + Math.random() * 5000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 5000
```

### PATCH-FIX-006-1773867632457-14g1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:985`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, 10000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 10000
```

### PATCH-FIX-006-1773867632457-vde1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:998`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
}, 15000)
```

**Fixed:**

```
/* TODO: Extract to named constant */ 15000
```

### PATCH-FIX-006-1773867632457-8cov

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1043`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ max: 500, threshold: 50 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-wok2

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1045`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
{ max: 10000, threshold: 2500 },
```

**Fixed:**

```
/* TODO: Extract to named constant */ 10000
```

### PATCH-FIX-006-1773867632457-6xtv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1073`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="xp-fill" style={{ width: `${Math.min(100, (gameState.xp / levelInfo.nextXP) * 100)}%` }}></div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-s0ov

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1206`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<button className="btn-ghost" onClick={() => quickSet(100)}>$100</button>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-nxpg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1267`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div key={idx} className="portfolio-bar" style={{ width: `${(item.hours / hoursPerDay) * 100}%`, background: item.color }}>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-fr4o

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1291`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>📡</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 245
```

### PATCH-FIX-006-1773867632457-mjc0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1299`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>💬</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 185
```

### PATCH-FIX-006-1773867632457-nuwt

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1307`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>🛠️</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 139
```

### PATCH-FIX-006-1773867632457-927f

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1315`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="agent-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>📈</div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 239
```

### PATCH-FIX-006-1773867632457-rsqr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1444`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const thresholds = [0, 50, 500, 2500]
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-m9yv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1445`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const maxes = [50, 500, 2500, 10000]
```

**Fixed:**

```
/* TODO: Extract to named constant */ 500
```

### PATCH-FIX-006-1773867632457-z4b1

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1588`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="progress-fill" style={{ width: `${Math.min(100, ((ach.progress || 0) / ach.target) * 100)}%` }}></div>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-t9g4

- **File:** `C:\Users\User\Desktop\OTM Agent\src\app\page.tsx:1685`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<span className="stat-value">{aiAnalysis.feasibilityScore}/100</span>
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-3ltv

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:44`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-3c2g

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\accordion.tsx:44`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-sojf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\calendar.tsx:33`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 180
```

### PATCH-FIX-006-1773867632457-4mwg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\calendar.tsx:33`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 180
```

### PATCH-FIX-006-1773867632457-l545

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dialog.tsx:72`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-r6xz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\dialog.tsx:72`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-6z66

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\input-otp.tsx:62`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000
```

### PATCH-FIX-006-1773867632457-6qwe

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\input-otp.tsx:62`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000
```

### PATCH-FIX-006-1773867632457-sswa

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\navigation-menu.tsx:78`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
className="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-99gz

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\navigation-menu.tsx:78`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
className="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-038w

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\progress.tsx:25`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-7wxq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\progress.tsx:25`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-f8uo

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sheet.tsx:61`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-dqpm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sheet.tsx:75`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 fo
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-7hgf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sheet.tsx:61`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-
```

**Fixed:**

```
/* TODO: Extract to named constant */ 300
```

### PATCH-FIX-006-1773867632457-ryyq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sheet.tsx:75`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
<SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 fo
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-y7np

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:221`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-oj92

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:232`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-t9bg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:408`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-397b

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:572`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-4ez4

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:221`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-z9wm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:232`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-gmhu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:408`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-
```

**Fixed:**

```
/* TODO: Extract to named constant */ 200
```

### PATCH-FIX-006-1773867632457-b6nu

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\sidebar.tsx:572`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-ll9q

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\slider.tsx:13`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max = 100,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-mdxm

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\slider.tsx:13`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
max = 100,
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-9lh0

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\toast.tsx:19`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-xcxf

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\toast.tsx:80`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructi
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-8kzd

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\toast.tsx:19`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-k6gp

- **File:** `C:\Users\User\Desktop\OTM Agent\src\components\ui\toast.tsx:80`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
"absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructi
```

**Fixed:**

```
/* TODO: Extract to named constant */ 100
```

### PATCH-FIX-006-1773867632457-fnsg

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-mobile.ts:3`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const MOBILE_BREAKPOINT = 768
```

**Fixed:**

```
/* TODO: Extract to named constant */ 768
```

### PATCH-FIX-006-1773867632457-kt5s

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-mobile.ts:3`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const MOBILE_BREAKPOINT = 768
```

**Fixed:**

```
/* TODO: Extract to named constant */ 768
```

### PATCH-FIX-006-1773867632457-b3mq

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-toast.ts:12`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const TOAST_REMOVE_DELAY = 1000000
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000000
```

### PATCH-FIX-006-1773867632457-fujr

- **File:** `C:\Users\User\Desktop\OTM Agent\src\hooks\use-toast.ts:12`
- **Confidence:** 80%
- **Automated:** Yes
- **Rationale:** Mark magic number for extraction to constant

**Original:**

```
const TOAST_REMOVE_DELAY = 1000000
```

**Fixed:**

```
/* TODO: Extract to named constant */ 1000000
```

---

_Report generated by CodeGang Analysis Pipeline at 2026-03-18T21:00:32.459Z_
