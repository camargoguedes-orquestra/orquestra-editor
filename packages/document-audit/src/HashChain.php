<?php
declare(strict_types=1);
namespace Orquestra\DocumentAudit;
use RuntimeException;

/** Encadeamento de evidencias. Checkpoints assinados externamente sao necessarios
 * para detectar reescrita integral por alguem com controle da base.
 */
final class HashChain {
    public static function canonical(mixed $data):string {
        if (is_array($data)) {
            if (array_is_list($data)) $data=array_map([self::class,'normalize'],$data);
            else { ksort($data,SORT_STRING); foreach($data as $k=>$v) $data[$k]=self::normalize($v); }
        }
        return json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    }
    private static function normalize(mixed $value):mixed {
        if (!is_array($value)) return $value;
        if (array_is_list($value)) return array_map([self::class,'normalize'],$value);
        ksort($value,SORT_STRING);foreach($value as $k=>$v)$value[$k]=self::normalize($v);
        return $value;
    }
    public static function append(string $previousHash,array $event):array {
        if (!preg_match('/^[a-f0-9]{64}$/D',$previousHash)) throw new RuntimeException('Hash anterior invalido');
        $json=self::canonical($event);
        return ['previousHash'=>$previousHash,'event'=>$event,'hash'=>hash('sha256',$previousHash."\n".$json)];
    }
    /** @return bool */
    public static function verify(array $events, string $genesis = ''):bool {
        $previous=$genesis!==''?$genesis:str_repeat('0',64);
        foreach($events as $item) {
            if (!isset($item['hash'],$item['previousHash'],$item['event']) || !is_array($item['event'])) return false;
            if (!hash_equals($previous,(string)$item['previousHash'])) return false;
            $expected=hash('sha256',$previous."\n".self::canonical($item['event']));
            if (!hash_equals($expected,(string)$item['hash'])) return false;
            $previous=$expected;
        }
        return true;
    }
}
