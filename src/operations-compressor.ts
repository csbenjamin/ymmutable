import { OperationsApplierJson } from "./operations-applier-json";
import { DeleteOperation, InsertOperation, Operation, setOperation, spliceOperation } from "./types";


export class OperationsCompressor {
    protected applier = new OperationsApplierJson();
    setOperations: setOperation[] = [];
    spliceOperations: spliceOperation[] = [];
    private cloneOperation(op: Operation): Operation {
        if (op.operation === 'set' || op.operation === 'delete') {
            return { ...op, path: [...op.path] };
        }
        return { ...op, path: [...op.path], items: [...op.items] };
    }
    addOperation(op: Operation) {
        op = this.cloneOperation(op);
        if (op.path.length === 0) {
            throw new Error('Path cannot be empty');
        }
        if (op.operation === 'set') {
            this.handleSetOperation(op);
        }
        if (op.operation === 'delete') {
            this.handleDeleteOperation(op);
        }
        if (op.operation === 'insert') {
            this.handleInsertOperation(op);
        }
        
    }
    private handleSetOperation(op: setOperation) {
        // Remover operações de set conflitantes
        for (let i = this.setOperations.length - 1; i >= 0; i--) {
            let children = this.pathsChildren(this.setOperations[i].path, op.path);
            if (children) {
                if (children.length === 0) {
                    this.setOperations.splice(i, 1);
                } else {
                    this.setOperations[i] = { ...this.setOperations[i] };
                    this.setOperations[i].path = [...this.setOperations[i].path];
                    this.setOperations[i].value = this.applier.applyOperations(this.setOperations[i].value, [{...op, path: children}]);
                    return;
                }
            } else {
                children = this.pathsChildren(op.path, this.setOperations[i].path);
                if (children) {
                    this.setOperations.splice(i, 1);
                }
            }
        }
        // Ajustar ou remover operações de splice que afetam este caminho
        for (let i = this.spliceOperations.length - 1; i >= 0; i--) {
            const children = this.pathsChildren(op.path, this.spliceOperations[i].path);
            if (children) {
                this.spliceOperations.splice(i, 1);
            }
        }
        this.setOperations.push(op);
    }
    private handleDeleteOperation(op: DeleteOperation) {
        for (let i = this.setOperations.length - 1; i >= 0; i--) {
            let children = this.pathsChildren(this.setOperations[i].path, op.path);
            if (children) {
                this.setOperations[i] = { ...this.setOperations[i] };
                this.setOperations[i].path = [...this.setOperations[i].path];
                this.setOperations[i].value = this.applier.applyOperations(this.setOperations[i].value, [{...op, path: children}]);
                return;
            } else {
                children = this.pathsChildren(op.path, this.setOperations[i].path);
                if (children) {
                    const arrIndex = children[0] as number;
                    if (arrIndex >= op.position) {
                        if (arrIndex < op.position + op.count) {
                            // Remover operações de set em itens deletados
                            this.setOperations.splice(i, 1);
                        } else {
                            // Ajustar índices após a operação de splice
                            this.setOperations[i] = { ...this.setOperations[i] };
                            this.setOperations[i].path = [...this.setOperations[i].path];
                            this.setOperations[i].path[op.path.length] = arrIndex - op.count;
                        }
                    }
                }
            }
            
        }
        const path = op.path.slice();
        let position = op.position;
        for (let i = this.spliceOperations.length - 1; i >= 0; i--) {
            const prevOp = this.spliceOperations[i];
            let children = this.pathsChildren(path, prevOp.path);
            if (children) {
                if (children.length > 0) {
                    const arrIndex = children[0] as number;
                    if (arrIndex >= position) {
                        if (arrIndex < position + op.count) {
                            // Remover operações de splice em itens deletados
                            this.spliceOperations.splice(i, 1);
                        }
                    }
                } else {
                    if (prevOp.operation === 'insert') {
                        if (prevOp.position + prevOp.items.length <= position) {
                            // A operação de inserção está antes da deleção, vamos ajustar a posição da deleção para antes da inserção
                            position -= prevOp.items.length;
                            continue;
                        }
                        if (prevOp.position < position + op.count) {
                            const startInsertion = prevOp.position;
                            const absoluteStartDeletion = position;
                            const endInsertion = prevOp.position + prevOp.items.length;
                            const endDeletion = position + op.count;
                            let relativeStartDeletion = Math.max(position - prevOp.position, 0);
                            let deletionCount = Math.min(endInsertion, endDeletion) - Math.max(startInsertion, absoluteStartDeletion);
                            // Remover itens inseridos previamente que serão deletados
                            prevOp.items.splice(relativeStartDeletion, deletionCount);
                            let prevPosition = prevOp.position;
                            const prevPath = prevOp.path.slice();
                            for (let j = i + 1; j < this.spliceOperations.length; j++) {
                                const nextOp = this.spliceOperations[j];
                                let children = this.pathsChildren(prevPath, nextOp.path);
                                if (children) {
                                    if (children.length > 0) {
                                        const arrIndex = children[0] as number;
                                        if (arrIndex > prevPosition + relativeStartDeletion) {
                                            // Ajustar índices para antes da deleção
                                            this.spliceOperations[j] = { ...this.spliceOperations[j] };
                                            this.spliceOperations[j].path = [...this.spliceOperations[j].path];
                                            this.spliceOperations[j].path[prevPath.length] = arrIndex - deletionCount;
                                        }
                                    } else {
                                        if (nextOp.position > prevPosition + relativeStartDeletion) {
                                            // Ajustar índices para antes da deleção
                                            nextOp.position -= deletionCount;
                                        } else {
                                            if (nextOp.operation === 'insert') {
                                                prevPosition += nextOp.items.length;
                                            } else {
                                                prevPosition -= nextOp.count;
                                            }
                                        }
                                    }
                                } else {
                                    children = this.pathsChildren(nextOp.path, prevPath);
                                    if (children) {
                                        const arrIndex = children[0] as number;
                                        if (nextOp.operation === 'insert') {
                                            if (arrIndex >= nextOp.position) {
                                                // Ajustar índices para antes da inserção
                                                prevPath[nextOp.path.length] = arrIndex + nextOp.items.length;
                                            }
                                        } else {
                                            if (arrIndex >= nextOp.position) {
                                                // Ajustar índices para antes da remoção
                                                prevPath[nextOp.path.length] = arrIndex - nextOp.count;
                                            }
                                        }
                                    }
                                }
                            }
                            if (prevOp.items.length === 0) {
                                // Remover operação de inserção vazia, pois deletamos tudo o que tinha sido inserido
                                this.spliceOperations.splice(i, 1);
                            } else if(prevOp.position < position) {
                                position -= prevOp.items.length;
                            }
                            op.count -= deletionCount;

                            if (op.count === 0) {
                                return;
                            }
                        }
                    } else {
                        if (prevOp.position <= position) {
                            position += prevOp.count;
                        }
                    }
                }
            } else {
                children = this.pathsChildren(prevOp.path, path);
                if (children) {
                    // children must be non empty, because the previous if statement would be true
                    const arrIndex = children[0] as number;
                    if (prevOp.operation === 'insert') {
                        if (arrIndex >= prevOp.position) {
                            if (arrIndex < prevOp.position + prevOp.items.length) {
                                // Estemos removendo filhos do que foi inserido previamente. Não há nada a ser feito com operações antes disso
                                break;
                            }
                            // Ajustar índices para antes da inserção
                            path[prevOp.path.length] = arrIndex - prevOp.items.length;
                        }
                    } else {
                        if (arrIndex >= prevOp.position) {
                            // Ajustar índices para antes da remoção
                            path[prevOp.path.length] = arrIndex + prevOp.count;
                        }
                    }
                }
            }
        }
        this.spliceOperations.push(op);
    }
    private handleInsertOperation(op: InsertOperation) {
        for (let i = this.setOperations.length - 1; i >= 0; i--) {
            let children = this.pathsChildren(this.setOperations[i].path, op.path);
            if (children) {
                this.setOperations[i] = { ...this.setOperations[i] };
                this.setOperations[i].path = [...this.setOperations[i].path];
                this.setOperations[i].value = this.applier.applyOperations(this.setOperations[i].value, [{...op, path: children}]);
                return;
            } else {
                children = this.pathsChildren(op.path, this.setOperations[i].path);
                if (children) {
                    const arrIndex = children[0] as number;
                    if (arrIndex >= op.position) {
                        this.setOperations[i] = { ...this.setOperations[i] };
                        this.setOperations[i].path = [...this.setOperations[i].path];
                        this.setOperations[i].path[op.path.length] = arrIndex + op.items.length;
                    }
                }
            }
            
        }
        this.spliceOperations.push(op);
    }
    private pathsChildren(prefix: (string | number)[], fullPath: (string | number)[]): null| (string | number)[] {
        if (prefix.length > fullPath.length) return null;
        for (let i = 0; i < prefix.length; i++) {
            if (prefix[i] !== fullPath[i]) return null;
        }
        return fullPath.slice(prefix.length);
    }

}