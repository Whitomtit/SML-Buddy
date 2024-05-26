
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  let
    fun f Empty = Empty
      | f (Node(n, l, r)) = Node(n, f r, f l)
  in
    f t
  end

