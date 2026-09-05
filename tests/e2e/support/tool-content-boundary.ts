import { expect, test, type Page } from '@playwright/test'
import {
  inspectNetworkRequest,
  inspectWebSocketFrame,
  redactToolContent,
  type NetworkBoundaryPolicy,
  type ToolContentCanary,
} from './privacy-boundary'

interface BoundaryFindings {
  consoleErrors: string[]
  pageErrors: string[]
  networkFindings: string[]
}

/**
 * Registers the guard every tool suite runs behind: each request, WebSocket
 * frame, console error and uncaught error of the page is inspected for the
 * canaries that stand in for that flow's tool content, and the test fails if
 * any of them leaves the device. Diagnostics are redacted, so a failure names
 * the category of content without reprinting it.
 */
export function guardToolContentBoundary(
  toolContent: readonly ToolContentCanary[],
  policy: NetworkBoundaryPolicy,
) {
  const findingsByPage = new WeakMap<Page, BoundaryFindings>()

  test.beforeEach(({ page }) => {
    const findings: BoundaryFindings = { consoleErrors: [], pageErrors: [], networkFindings: [] }
    findingsByPage.set(page, findings)

    page.on('console', (message) => {
      if (message.type() === 'error') findings.consoleErrors.push(redactToolContent(message.text(), toolContent))
    })
    page.on('pageerror', error => findings.pageErrors.push(redactToolContent(error.message, toolContent)))
    page.context().on('request', (request) => {
      findings.networkFindings.push(...inspectNetworkRequest({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        body: request.postData(),
      }, toolContent, policy))
    })
    page.on('websocket', (socket) => {
      findings.networkFindings.push(...inspectNetworkRequest({
        url: socket.url(),
        method: 'WEBSOCKET',
        headers: {},
        body: null,
      }, toolContent, policy))
      socket.on('framesent', (event) => {
        findings.networkFindings.push(...inspectWebSocketFrame(socket.url(), event.payload, toolContent, policy))
      })
    })
  })

  test.afterEach(({ page }) => {
    const findings = findingsByPage.get(page)!
    expect(findings.networkFindings, `工具內容網路邊界違規：\n${findings.networkFindings.join('\n')}`).toEqual([])
    expect(findings.consoleErrors, `console errors：\n${findings.consoleErrors.join('\n')}`).toEqual([])
    expect(findings.pageErrors, `page errors：\n${findings.pageErrors.join('\n')}`).toEqual([])
  })
}
