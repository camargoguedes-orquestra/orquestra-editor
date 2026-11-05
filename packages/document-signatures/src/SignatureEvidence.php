<?php
declare(strict_types=1);
namespace Orquestra\DocumentSignatures;
use RuntimeException;

/** Diferencia 'detectada' de 'validada'. Verificacao criptografica depende de adaptador confiavel. */
final class SignatureEvidence {
    public static function detectPdfMarkers(string $bytes):array {
        $count=preg_match_all('/\/ByteRange\s*\[/',$bytes,$m);
        return ['format'=>'PDF/PAdES','detected'=>$count>0,'signatureCountHints'=>$count,
            'validationStatus'=>'not_verified','warning'=>'ByteRange indica possivel assinatura. Nao atesta validade, pessoa ou integridade.'];
    }
    public static function report(array $verification):array {
        $status=(string)($verification['status']??'inconclusive');
        if(!in_array($status,['valid','invalid','inconclusive','pending'],true)) throw new RuntimeException('Resultado de validacao invalido');
        return ['status'=>$status,'provider'=>(string)($verification['provider']??''),
            'checkedAt'=>(string)($verification['checkedAt']??gmdate('c')),
            'evidence'=>$verification['evidence']??[]];
    }
}
