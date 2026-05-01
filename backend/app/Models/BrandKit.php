<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BrandKit extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'client_id',
        'name',
        'category',
        'content',
        'file_url',
        'link_url',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}
