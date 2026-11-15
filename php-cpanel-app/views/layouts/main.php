<?php
declare(strict_types=1);
$base = htmlspecialchars((string) ($config['base_path'] ?? ''), ENT_QUOTES, 'UTF-8');
$title = htmlspecialchars((string) ($pageTitle ?? 'Nightingale Tea Tourism · Estate Reservations'), ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= $title ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="<?= $base ?>/assets/css/app.css" />
  <script src="https://checkout.razorpay.com/v1/checkout.js" defer></script>
</head>
<body>
  <header class="topbar no-print">
    <div class="container topbar-inner">
      <a href="<?= $base ?>/" class="brand">Nightingale Tea</a>
      <nav class="nav-links">
        <a href="<?= $base ?>/#estates">Estates</a>
        <a href="<?= $base ?>/#availability">Availability</a>
        <a href="<?= $base ?>/#track">Track Booking</a>
        <a href="<?= $base ?>/admin">Admin Console</a>
        <a href="<?= htmlspecialchars((string) ($config['primary_domain'] ?? 'https://nightingaletea.com'), ENT_QUOTES, 'UTF-8') ?>">Main Website</a>
      </nav>
      <a href="<?= $base ?>/#reserve" class="btn btn-primary">Book a Stay</a>
    </div>
  </header>

  <main>
    <?= $content ?? '' ?>
  </main>

  <footer class="no-print" style="border-top:1px solid var(--border);margin-top:64px;padding:32px 0;background:var(--surface)">
    <div class="container" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;font-size:0.85rem;color:var(--text-muted)">
      <div>
        <strong style="color:var(--text)">Nightingale Tea Tourism</strong> · 11, Shakespeare Sarani, Kolkata 700071
      </div>
      <div>
        Support: <?= htmlspecialchars((string) ($settings['support_phone'] ?? '+91 95839 36626'), ENT_QUOTES, 'UTF-8') ?> · <?= htmlspecialchars((string) ($settings['support_email'] ?? 'sales@nightingaletea.in'), ENT_QUOTES, 'UTF-8') ?>
      </div>
    </div>
  </footer>
</body>
</html>
