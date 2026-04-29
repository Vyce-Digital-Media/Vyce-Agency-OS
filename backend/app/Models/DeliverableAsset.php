<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeliverableAsset extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'deliverable_id',
        'file_name',
        'file_url',
        'file_type',
        'file_size',
        'uploaded_by',
    ];

    public function deliverable()
    {
        return $this->belongsTo(Deliverable::class);
    }
}
