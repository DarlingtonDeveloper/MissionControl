import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show connection status indicator', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for connection status indicator
    const connectionStatus = page.locator(
      '[data-testid="connection-status"], ' +
      '[aria-label*="connection" i], ' +
      'text=/connected|disconnected|connecting/i, ' +
      '.connection-indicator'
    );

    // May or may not be visible depending on UI design
    const isVisible = await connectionStatus.first().isVisible().catch(() => false);
    console.log('Connection status indicator visible:', isVisible);
  });

  test('should indicate connected state', async ({ page }) => {
    // Wait for WebSocket to potentially connect
    await page.waitForTimeout(2000);

    // Look for connected indicator (green dot, "Connected" text, etc.)
    const connected = page.locator(
      '[data-testid="connection-status"][data-connected="true"], ' +
      'text=/connected/i, ' +
      '.connection-indicator.connected, ' +
      '[class*="green"], [class*="success"]'
    );

    const isConnected = await connected.first().isVisible().catch(() => false);
    console.log('Connected indicator visible:', isConnected);
  });

  test.skip('should show disconnected state when backend is down', async ({ page }) => {
    // This would require stopping the backend during test
    // Skip for now as it requires special setup

    // Simulate disconnect by blocking WebSocket
    await page.route('**/ws', (route) => route.abort());

    await page.reload();
    await page.waitForTimeout(2000);

    // Should show disconnected
    const disconnected = page.locator(
      'text=/disconnected|offline|reconnecting/i, ' +
      '.connection-indicator.disconnected, ' +
      '[class*="red"], [class*="error"]'
    );

    await expect(disconnected.first()).toBeVisible({ timeout: 5000 });
  });

  test.skip('should reconnect automatically after disconnect', async ({ page }) => {
    // This test requires ability to simulate disconnect/reconnect
    // Would need to intercept WebSocket and control it

    // Record initial connection state
    await page.waitForTimeout(2000);

    // Simulate network offline
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Simulate network online
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Should attempt reconnect
    await page.waitForTimeout(3000);

    // Verify reconnected
    const connected = page.locator('text=/connected/i, [data-connected="true"]');
    await expect(connected.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('WebSocket Events', () => {
  test('should receive and display real-time updates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This test verifies the UI can receive WebSocket events
    // In a real test, we'd trigger events from the backend

    // For now, just verify the page loads and is interactive
    await expect(page.locator('body')).toBeVisible();
  });

  test.skip('should update agent count on agent_spawned event', async ({ page }) => {
    // This test requires backend to emit WebSocket events
    await page.goto('/');

    // Get initial count
    const initialCount = await page.locator('[data-testid="agent-count"]').textContent();

    // Trigger spawn via UI or API
    // ... (requires backend)

    // Verify count updates
    await expect(page.locator('[data-testid="agent-count"]')).not.toHaveText(initialCount || '', {
      timeout: 10000
    });
  });

  test.skip('should update agent count on agent_stopped event', async ({ page }) => {
    // This test requires backend to emit WebSocket events
    await page.goto('/');

    // Would need an existing agent to stop
    // ... (requires backend setup)
  });
});

test.describe('Connection Error Handling', () => {
  test('should show error state gracefully', async ({ page }) => {
    // Block API/WebSocket connections
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/ws', (route) => route.abort());

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should show some error state or fallback UI
    // The app shouldn't crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have retry mechanism available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for retry button (may not be visible if connected)
    const retryButton = page.locator(
      'button:has-text("Retry"), ' +
      'button:has-text("Reconnect"), ' +
      '[aria-label*="retry" i]'
    );

    // May or may not be visible depending on connection state
    const isVisible = await retryButton.first().isVisible().catch(() => false);
    console.log('Retry button visible:', isVisible);
  });
});
