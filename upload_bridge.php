<?php
// Configuración de Seguridad
$SECRET_TOKEN = '8f2d6c1a9e3b4f5d8a0c2e4b6d8f0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e'; // Inventa una clave segura
$UPLOAD_DIR = 'uploads/'; // Asegúrate de que esta carpeta exista y tenga permisos 755

// 1. Verificar Token de Seguridad
$headers = getallheaders();
$providedToken = $headers['Authorization'] ?? '';

if ($providedToken !== $SECRET_TOKEN) {
    http_response_code(403);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

// 2. Validar que venga un archivo
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $fileName = time() . '_' . basename($file['name']); // Evitar nombres duplicados
    $targetPath = $UPLOAD_DIR . $fileName;

    // 3. Validar extensiones (Seguridad)
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!in_array($file['type'], $allowedTypes)) {
        http_response_code(400);
        echo json_encode(["error" => "Tipo de archivo no permitido"]);
        exit;
    }

    // 4. Mover el archivo a la carpeta final
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode([
            "success" => true,
            "url" => "https://erp.tradestandart.com.mx/" . $targetPath
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Error al guardar el archivo"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["error" => "Petición inválida"]);
}