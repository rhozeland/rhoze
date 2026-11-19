import {useState} from "react";


// ---------------------------------------------------------------------------
// Taiga #142
// Build the confirmation dialog (S)
// ---------------------------------------------------------------------------

export type LineItemSummary = {description: string, amount_cents: number, spent_on: string};

type Props = {
    item: LineItemSummary;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
};

export default function CreateLineItemDialog({item, onCancel, onConfirm}, props: Props) {


    return(

    );
}