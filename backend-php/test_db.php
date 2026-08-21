<?php
header('Content-Type: text/plain');
echo "--- INBOUND.PHP CONTENT ---\n";
echo file_get_contents(__DIR__ . '/routes/inbound.php');
