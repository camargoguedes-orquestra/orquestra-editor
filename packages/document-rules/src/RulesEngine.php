<?php
declare(strict_types=1);
namespace Orquestra\DocumentRules;
use RuntimeException;

/** Engine deterministico e independente de IA. Regras devem ser publicadas por admin autorizado. */
final class RulesEngine {
    /** @return array categorias, tags, extracoes e relatorio de regras que coincidiram */
    public function classify(array $document,array $rules):array {
        $text=mb_strtolower(mb_substr((string)($document['text']??''),0,1000000),'UTF-8');
        $extension=strtolower((string)($document['extension']??''));
        $result=['category'=>null,'tags'=>[],'extract'=>[],'matchedRules'=>[],'reviewRequired'=>false];
        usort($rules,static fn($a,$b)=>(int)($a['priority']??100)<=>(int)($b['priority']??100));
        foreach($rules as $rule) {
            if (empty($rule['enabled'])) continue;
            $id=(string)($rule['id']??'');
            if ($id==='') throw new RuntimeException('Regra sem identificador');
            $cond=$rule['conditions']??[];
            if (isset($cond['extensions']) && !in_array($extension,$cond['extensions'],true)) continue;
            $terms=$cond['textContainsAny']??[];
            if ($terms!==[]) {
                $matched=false;
                foreach($terms as $term) if ($term!=='' && mb_strpos($text,mb_strtolower((string)$term,'UTF-8'))!==false) {$matched=true;break;}
                if (!$matched) continue;
            }
            $result['matchedRules'][]=$id;
            $actions=$rule['actions']??[];
            if (isset($actions['category'])) {
                if ($result['category']!==null && $result['category']!==$actions['category']) $result['reviewRequired']=true;
                else $result['category']=$actions['category'];
            }
            foreach($actions['addTags']??[] as $tag) if(is_string($tag)&&$tag!=='')$result['tags'][$tag]=$tag;
            foreach($cond['extract']??[] as $field=>$spec) {
                $pattern=$spec['pattern']??null;
                if (!is_string($pattern) || strlen($pattern)>500) throw new RuntimeException('Regex invalida');
                if (!str_starts_with($pattern,'/') && !str_starts_with($pattern,'~')) $pattern='~'.$pattern.'~iu';
                // Limitar custo de regex com pcre.backtrack_limit em processamento de documentos nao confiaveis.
                $old=ini_get('pcre.backtrack_limit');
                ini_set('pcre.backtrack_limit','100000');
                try { $ok=@preg_match($pattern,(string)($document['text']??''),$m); }
                finally {ini_set('pcre.backtrack_limit',(string)$old);}
                if ($ok===false) throw new RuntimeException('Erro de regex no perfil');
                if ($ok===1) $result['extract'][$field]=$m[1]??$m[0];
            }
            if (!empty($actions['suggestAssociation'])) $result['suggestions'][]=$actions['suggestAssociation'];
        }
        $result['tags']=array_values($result['tags']);
        if (count($result['matchedRules'])>1 && $result['reviewRequired']) $result['reviewRequired']=true;
        return $result;
    }
}
