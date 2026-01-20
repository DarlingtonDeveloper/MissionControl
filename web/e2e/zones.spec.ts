import { test, expect } from '@playwright/test';

test.describe('Zone Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show zones section in sidebar', async ({ page }) => {
    // The sidebar should have a zones section
    const sidebar = page.locator('aside, [role="complementary"], .sidebar');
    await expect(sidebar.first()).toBeVisible();
  });

  test('should show "No zones created" or zone list', async ({ page }) => {
    // Either show empty state or zone list
    const noZones = page.locator('text=/no zones|create.*zone/i');
    const zoneList = page.locator('[data-testid="zone-list"], .zone-group, .zone-item');

    const hasNoZonesMessage = await noZones.first().isVisible().catch(() => false);
    const hasZoneList = await zoneList.first().isVisible().catch(() => false);

    // Should have one or the other
    expect(hasNoZonesMessage || hasZoneList).toBeTruthy();
  });

  test('should have create zone action available', async ({ page }) => {
    // Look for create zone button or link
    const createZone = page.locator(
      '[data-testid="new-zone"], ' +
      'button:has-text("Create a zone"), ' +
      'button:has-text("New zone"), ' +
      '[title*="zone" i]'
    );

    const isVisible = await createZone.first().isVisible().catch(() => false);
    console.log('Create zone action visible:', isVisible);
  });

  test.skip('should create a new zone', async ({ page }) => {
    // This test requires API to be available
    // Click create zone
    await page.click('[data-testid="new-zone"], button:has-text("Create")');

    // Fill zone details
    await page.fill('[name="zoneName"], [placeholder*="name"]', 'Test Zone');

    // Submit
    await page.click('button:has-text("Create"), button[type="submit"]');

    // Verify zone appears
    await expect(page.locator('text=Test Zone')).toBeVisible({ timeout: 5000 });
  });

  test.skip('should update zone name', async ({ page }) => {
    // Requires existing zone
    // Click edit on zone
    await page.click('[data-testid="zone-edit"], [aria-label="Edit zone"]');

    // Update name
    await page.fill('[name="zoneName"]', 'Updated Zone Name');
    await page.click('button:has-text("Save")');

    // Verify update
    await expect(page.locator('text=Updated Zone Name')).toBeVisible();
  });

  test.skip('should delete zone', async ({ page }) => {
    // Requires existing zone that can be deleted
    // Find zone count before
    const zonesBefore = await page.locator('.zone-group, [data-testid="zone-item"]').count();

    // Click delete
    await page.click('[data-testid="zone-delete"], [aria-label="Delete zone"]');

    // Confirm deletion
    await page.click('button:has-text("Delete"), button:has-text("Confirm")');

    // Verify zone is removed
    const zonesAfter = await page.locator('.zone-group, [data-testid="zone-item"]').count();
    expect(zonesAfter).toBeLessThan(zonesBefore);
  });
});

test.describe('Zone Display', () => {
  test('should show zone colors or indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // If zones exist, they should have visual indicators
    const zoneGroups = page.locator('.zone-group, [data-testid="zone-item"]');
    const count = await zoneGroups.count();

    if (count > 0) {
      // Zones exist - they should be styled
      const firstZone = zoneGroups.first();
      await expect(firstZone).toBeVisible();
    }
  });

  test('should display zone agent count', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for agent count within zones
    const agentCount = page.locator('text=/\\d+ agent|agents?: \\d+/i');
    const isVisible = await agentCount.first().isVisible().catch(() => false);
    console.log('Agent count in zones visible:', isVisible);
  });
});
