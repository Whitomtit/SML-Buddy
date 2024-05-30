datatype ae = CONST of int
            | VAR of string
            | POWER of string * int
            | TIMES of ae list
            | SUM of ae list

fun diff (ae, str) =
    case ae of
        CONST c => CONST 0
      | VAR v => if str = v then CONST 1 else CONST 0
      | POWER (v, p) =>
            if v = str then TIMES [CONST p, POWER (v, p - 1)] else CONST 0
      | TIMES ael =>
            (case ael of
                [] => TIMES []
              | [hd] => diff (hd, str)
              | hd :: tl =>
                    SUM [ TIMES ((diff (hd, str)) :: tl),
                          TIMES [hd, diff (TIMES tl, str)] ]
            )
      | SUM ael =>
            let
                fun diffwithstr e = diff (e, str)
            in
                SUM (map diffwithstr ael)
            end
