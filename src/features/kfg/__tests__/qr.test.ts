import { buildKfgQrCode, msUntilNextBucket } from '../qr';
import { isQrValid, parseQrCode } from '../../../../functions/src/kfgLogic';

describe('KfG QR code', () => {
  it('is accepted by the server-side verifier', () => {
    const now = Date.now();
    const code = buildKfgQrCode('a1b2c3', 'mission_uid', now);
    const parsed = parseQrCode(code);
    expect(parsed).not.toBeNull();
    expect(isQrValid('a1b2c3', parsed!.participationId, parsed!.bucket, parsed!.sig, now)).toBe(true);
  });

  it('changes every 30 seconds', () => {
    const t = 1_800_000_000_000;
    expect(buildKfgQrCode('s', 'p', t)).not.toBe(buildKfgQrCode('s', 'p', t + 30_000));
    expect(msUntilNextBucket(t + 5_000)).toBe(25_000);
  });
});
