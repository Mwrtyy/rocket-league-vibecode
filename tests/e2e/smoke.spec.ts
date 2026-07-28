import { expect, test } from '@playwright/test';

test('client boots and exposes the foundation status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('AETHER STRIKE')).toBeVisible();
  await expect(page.getByText(/physics runs at 120 Hz/i)).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});
