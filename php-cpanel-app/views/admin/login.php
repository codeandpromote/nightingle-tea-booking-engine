<?php
declare(strict_types=1);
$base = htmlspecialchars((string) ($config['base_path'] ?? ''), ENT_QUOTES, 'UTF-8');
$pageTitle = 'Admin Login · Nightingale Tea Tourism';
ob_start();
?>
<section style="padding:64px 0">
  <div class="container" style="max-width:440px">
    <div class="card">
      <h1 style="font-size:1.9rem;margin:0 0 8px">Estate Admin Console</h1>
      <p style="font-size:0.875rem;color:var(--text-muted);margin:0 0 20px">Sign in to verify manual UPI payments, manage inventory blocks, and export guest manifests.</p>
      <?php if (!empty($error)): ?>
        <div style="padding:10px 12px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;margin-bottom:16px;font-size:0.85rem">
          <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
        </div>
      <?php endif; ?>
      <form method="POST" action="<?= $base ?>/admin/login">
        <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
        <div style="margin-bottom:14px">
          <label class="label">Username</label>
          <input class="input" name="username" required autocomplete="username" />
        </div>
        <div style="margin-bottom:18px">
          <label class="label">Password</label>
          <input class="input" type="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">Sign In to Console</button>
      </form>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
require dirname(__DIR__) . '/layouts/main.php';
