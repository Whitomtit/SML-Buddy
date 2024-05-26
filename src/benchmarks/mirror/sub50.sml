
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  let
    fun aux Empty = Empty
      | aux (Node (n, l, r)) = Node (n, aux r, aux l)
  in
    aux t
  end

