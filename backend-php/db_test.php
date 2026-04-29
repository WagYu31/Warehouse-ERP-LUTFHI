<?php error_reporting(E_ALL); ini_set("display_errors", 1); try { require "config/database.php"; $db = getDB(); echo "DB OK"; } catch(Exception $e) { echo "DB ERROR: " . $e->getMessage(); } ?>
