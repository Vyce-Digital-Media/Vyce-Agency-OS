<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ClientAsset extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'client_id',
        'file_name',
        'file_url',
        'file_type',
        'file_size',
        'uploaded_by',
        'category',
        'asset_name',
        'content_type',
        'notes',
        'section',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}
