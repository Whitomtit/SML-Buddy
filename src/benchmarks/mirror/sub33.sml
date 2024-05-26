
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  let
    fun aux Empty = Empty
      | aux (Node (x, l, r)) = Node (x, aux r, aux l)
  in
    aux t
  end

