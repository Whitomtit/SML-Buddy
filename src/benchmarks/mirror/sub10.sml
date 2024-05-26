
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  let
    fun helper t =
      case t of
        Empty => t
      | Node (n, l1, r1) => Node (n, helper r1, helper l1)
  in
    helper t
  end

