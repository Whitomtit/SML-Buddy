
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  let
    fun helper Empty = Empty
      | helper (Node(n, l, r)) = Node(n, helper r, helper l)
  in
    helper t
  end
