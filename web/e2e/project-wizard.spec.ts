import { test, expect } from '@playwright/test';

test.describe('Project Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open wizard when clicking new project button', async ({ page }) => {
    // Click the + button to open wizard
    await page.click('[title="New project"]');

    // Verify wizard is open
    await expect(page.locator('text=New Project')).toBeVisible();
    await expect(page.locator('text=set up your project')).toBeVisible();
  });

  test('should show path input and audience selector in setup step', async ({ page }) => {
    await page.click('[title="New project"]');

    // Check for path input
    await expect(page.locator('input[placeholder*="projects"]')).toBeVisible();

    // Check for audience buttons
    await expect(page.locator('button:has-text("Personal")')).toBeVisible();
    await expect(page.locator('button:has-text("Customers")')).toBeVisible();
  });

  test('should disable continue button when path is empty', async ({ page }) => {
    await page.click('[title="New project"]');

    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeDisabled();
  });

  test('should enable continue button when path is filled', async ({ page }) => {
    await page.click('[title="New project"]');

    // Fill in the path
    await page.fill('input[placeholder*="projects"]', '/tmp/test-project');

    // Wait for the continue button to be enabled
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeEnabled();
  });

  test('should navigate to matrix step on continue', async ({ page }) => {
    await page.click('[title="New project"]');
    await page.fill('input[placeholder*="projects"]', '/tmp/test-project');
    await page.click('button:has-text("Continue")');

    // Verify we're on the matrix step
    await expect(page.locator('text=your workflow')).toBeVisible();
  });

  test('should switch audience between Personal and Customers', async ({ page }) => {
    await page.click('[title="New project"]');

    // Click Customers
    await page.click('button:has-text("Customers")');
    await expect(page.locator('text=Customer-facing projects')).toBeVisible();

    // Click Personal
    await page.click('button:has-text("Personal")');
    await expect(page.locator('text=Personal projects skip')).toBeVisible();
  });

  test('should navigate back from matrix to setup', async ({ page }) => {
    await page.click('[title="New project"]');
    await page.fill('input[placeholder*="projects"]', '/tmp/test-project');
    await page.click('button:has-text("Continue")');

    // Go back
    await page.click('button:has-text("Back")');

    // Verify we're back on setup
    await expect(page.locator('input[placeholder*="projects"]')).toBeVisible();
  });

  test('should show checkbox options in setup step', async ({ page }) => {
    await page.click('[title="New project"]');

    await expect(page.locator('text=Initialize git')).toBeVisible();
    await expect(page.locator('text=Enable King')).toBeVisible();
  });

  test('should close wizard on cancel', async ({ page }) => {
    await page.click('[title="New project"]');
    await page.click('button:has-text("Cancel")');

    // Wizard should be closed
    await expect(page.locator('text=set up your project')).not.toBeVisible();
  });

  test('should show matrix with phases and zones', async ({ page }) => {
    await page.click('[title="New project"]');
    await page.fill('input[placeholder*="projects"]', '/tmp/test-project');
    await page.click('button:has-text("Continue")');

    // Check for phases
    await expect(page.locator('text=Idea')).toBeVisible();
    await expect(page.locator('text=Design')).toBeVisible();
    await expect(page.locator('text=Implement')).toBeVisible();

    // Check for zones
    await expect(page.locator('th:has-text("Frontend")')).toBeVisible();
    await expect(page.locator('th:has-text("Backend")')).toBeVisible();
  });
});
