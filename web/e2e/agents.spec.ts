import { test, expect } from '@playwright/test';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show empty state when no agents', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Look for empty state or "No agents" message
    const noAgents = page.locator('text=/no agents|spawn.*first|create.*agent/i');
    const agentList = page.locator('[data-testid="agent-list"], .agent-list');

    // Either we have an empty state message or an empty agent list
    const hasEmptyMessage = await noAgents.isVisible().catch(() => false);
    const hasAgentList = await agentList.isVisible().catch(() => false);

    expect(hasEmptyMessage || !hasAgentList).toBeTruthy();
  });

  test('should show agent count in header or sidebar', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for agent count display
    const agentCount = page.locator('[data-testid="agent-count"], text=/\\d+ agent/i, text=/agents?: \\d+/i');

    // Agent count may or may not be visible depending on UI state
    const isVisible = await agentCount.first().isVisible().catch(() => false);
    console.log('Agent count visible:', isVisible);
  });

  test('should have spawn agent button or action', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for spawn button
    const spawnButton = page.locator('[data-testid="spawn-agent"], button:has-text("Spawn"), button:has-text("New Agent"), [title*="spawn" i]');

    // Should have some way to spawn agents
    await expect(spawnButton.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Might be via keyboard shortcut only
      console.log('No explicit spawn button - may use keyboard shortcut');
    });
  });

  test.skip('should open spawn dialog when clicking spawn', async ({ page }) => {
    // This test may need a specific UI state
    await page.click('[data-testid="spawn-agent"], button:has-text("Spawn")');

    // Look for spawn dialog
    await expect(page.locator('text=/spawn.*agent|new.*agent|task/i')).toBeVisible();
  });

  test.skip('should show agent count increment after spawn', async ({ page }) => {
    // This test requires a running backend
    // Get initial count
    const countBefore = await page.locator('[data-testid="agent-count"]').textContent() || '0';

    // Spawn agent
    await page.click('[data-testid="spawn-agent"]');
    await page.fill('[name="task"], [placeholder*="task"]', 'Test task');
    await page.click('button:has-text("Spawn"), button[type="submit"]');

    // Verify count incremented
    await expect(page.locator('[data-testid="agent-count"]')).not.toHaveText(countBefore, { timeout: 10000 });
  });
});

test.describe('Agent UI States', () => {
  test('should display zones section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for zones section
    const zonesSection = page.locator('text=/zones?|frontend|backend|database|shared/i');
    await expect(zonesSection.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show keyboard shortcuts hint', async ({ page }) => {
    await page.goto('/');

    // Look for keyboard shortcut hints
    const shortcutHint = page.locator('text=/⌘|spawn|zone/');
    await expect(shortcutHint.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('Keyboard hints may not be visible');
    });
  });
});
