<?php
declare(strict_types=1);
namespace Orquestra\DocumentRequests;
use RuntimeException;

/** Máquina de estados para solicitacoes: nao inclui autenticacao nem persistencia. */
final class RequestWorkflow {
    private const NEXT = [
        'draft'=>['sent','canceled'],
        'sent'=>['received','expired','canceled'],
        'received'=>['under_review','canceled'],
        'under_review'=>['approved','rejected','correction_requested'],
        'correction_requested'=>['received','expired','canceled'],
        'rejected'=>['correction_requested','canceled'],
        'approved'=>[], 'canceled'=>[], 'expired'=>[]
    ];
    public static function transition(string $current,string $next):string {
        if (!in_array($next,self::NEXT[$current]??[],true))
            throw new RuntimeException('Transicao documental nao permitida: '.$current.' -> '.$next);
        return $next;
    }
    public static function allowed(string $current):array {return self::NEXT[$current]??[];}
    public static function requireComplete(array $required,array $submitted):void {
        $missing=array_diff($required,$submitted);
        if ($missing!==[]) throw new RuntimeException('Documentos obrigatorios pendentes: '.implode(',',$missing));
    }
}
