/**
 * OguriCap/ai/cd.js
 * -----------------------------------------------------------------------
 * Re-export Mahiru cooldown.
 */

import { checkMahiruCooldown } from './mahiru/helper.js';

export function cekCooldown(id, delay = 3000) {
	return checkMahiruCooldown(id, delay);
}
